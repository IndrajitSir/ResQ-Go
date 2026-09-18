import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Booking } from '@prisma/client';
import {
  assertTransition,
  type AssignAmbulanceDto,
  type BookingView,
  type TripView,
  type UrgencyCategory,
} from '@abs/contracts';
import { mapAmbulance, mapBooking, mapTrip, mapTripLocation } from '../common/mappers';
import { ApiException } from '../common/errors/api-exception';
import { haversineKm, roundKm } from '../common/geo';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/auth/auth-user';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeService } from '../realtime/realtime.service';

/** Bookings waiting for a vehicle. */
const QUEUE_STATUSES = ['REQUESTED', 'SEARCHING'] as const;

/** Statuses a booking may hold while it is (re)assigned to a vehicle. */
const ASSIGNABLE_STATUSES = ['REQUESTED', 'SEARCHING'] as const;

/** Emergencies are worked first, then urgency, then age. */
const URGENCY_WEIGHT: Record<UrgencyCategory, number> = {
  EMERGENCY: 0,
  URGENT: 1,
  PLANNED: 2,
};

/** True for a Prisma unique-constraint violation (P2002). */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class DispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
  ) {}

  async queue(): Promise<BookingView[]> {
    const rows = await this.prisma.booking.findMany({
      where: { status: { in: [...QUEUE_STATUSES] } },
      include: {
        requester: { select: { publicId: true } },
        trip: {
          include: {
            ambulance: { select: { publicId: true } },
            driver: { select: { publicId: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    return rows
      .map((row) => mapBooking(row))
      .sort((a, b) => {
        const byUrgency = URGENCY_WEIGHT[a.urgency] - URGENCY_WEIGHT[b.urgency];
        if (byUrgency !== 0) return byUrgency;
        return a.createdAt.localeCompare(b.createdAt);
      });
  }

  /** Available vehicles of the required type, nearest first. */
  async eligible(bookingPublicId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { publicId: bookingPublicId },
      select: {
        requiredAmbulanceType: true,
        pickupLatitude: true,
        pickupLongitude: true,
        status: true,
      },
    });
    if (!booking) {
      throw new ApiException('NOT_FOUND', HttpStatus.NOT_FOUND, 'Booking not found');
    }

    const ambulances = await this.prisma.ambulance.findMany({
      where: { status: 'AVAILABLE', type: booking.requiredAmbulanceType },
      include: { driver: { select: { publicId: true, name: true } } },
    });

    const pickup = { latitude: booking.pickupLatitude, longitude: booking.pickupLongitude };
    return ambulances
      .map((row) => {
        const view = mapAmbulance(row);
        if (row.baseLatitude !== null && row.baseLongitude !== null) {
          view.distanceKm = roundKm(
            haversineKm(pickup, { latitude: row.baseLatitude, longitude: row.baseLongitude }),
          );
        }
        return view;
      })
      .sort((a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER));
  }

  async assign(
    bookingPublicId: string,
    dto: AssignAmbulanceDto,
    user: AuthUser,
    requestId: string,
  ): Promise<{ booking: BookingView; trip: TripView }> {
    let result: {
      booking: Booking;
      trip: { publicId: string };
      previousStatus: string;
      ambulancePublicId: string;
      driverPublicId: string;
      requesterId: string;
      requesterPublicId: string | null;
      driverUserId: string;
    };

    try {
      result = await this.prisma.$transaction(async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { publicId: bookingPublicId },
          include: { requester: { select: { publicId: true } } },
        });
        if (!booking) {
          throw new ApiException('NOT_FOUND', HttpStatus.NOT_FOUND, 'Booking not found');
        }
        if (!(ASSIGNABLE_STATUSES as readonly string[]).includes(booking.status)) {
          throw new ApiException(
            'CONFLICT',
            HttpStatus.CONFLICT,
            `Booking cannot be assigned in status ${booking.status}`,
          );
        }

        const ambulance = await tx.ambulance.findUnique({
          where: { publicId: dto.ambulanceId },
          include: { driver: { include: { driverProfile: true } } },
        });
        if (!ambulance) {
          throw new ApiException('NOT_FOUND', HttpStatus.NOT_FOUND, 'Ambulance not found');
        }

        // 1. Claim the vehicle atomically. This is what makes two dispatchers
        //    racing for the same ambulance safe: only one conditional update wins.
        const vehicleClaim = await tx.ambulance.updateMany({
          where: { id: ambulance.id, status: 'AVAILABLE' },
          data: { status: 'ON_TRIP' },
        });
        if (vehicleClaim.count === 0) {
          throw new ApiException('CONFLICT', HttpStatus.CONFLICT, 'Ambulance no longer available');
        }

        const driver = ambulance.driver;
        const profile = driver?.driverProfile;
        if (!driver) {
          throw new ApiException(
            'CONFLICT',
            HttpStatus.CONFLICT,
            'This ambulance has no crew attached. Attach a driver before dispatching it.',
          );
        }
        if (!profile || profile.availability !== 'AVAILABLE' || profile.identityVerification !== 'VERIFIED') {
          throw new ApiException(
            'CONFLICT',
            HttpStatus.CONFLICT,
            'Driver is not available or not verified for assignment',
          );
        }

        // 2. Claim the booking atomically. Without this, two dispatchers could
        //    each lock a different vehicle for the same request.
        assertTransition(booking.status as Parameters<typeof assertTransition>[0], 'SEARCHING');
        const bookingClaim = await tx.booking.updateMany({
          where: { id: booking.id, status: { in: [...ASSIGNABLE_STATUSES] } },
          data: { status: 'SEARCHING' },
        });
        if (bookingClaim.count === 0) {
          throw new ApiException(
            'CONFLICT',
            HttpStatus.CONFLICT,
            'This request is already being dispatched to another crew',
          );
        }

        if (booking.status === 'REQUESTED') {
          await tx.bookingEvent.create({
            data: {
              publicId: randomUUID(),
              bookingId: booking.id,
              type: 'STATUS_CHANGED',
              previousStatus: 'REQUESTED',
              newStatus: 'SEARCHING',
              actorPublicId: user.publicId,
              metadata: JSON.stringify({}),
            },
          });
        }
        await tx.bookingEvent.create({
          data: {
            publicId: randomUUID(),
            bookingId: booking.id,
            type: 'AMBULANCE_ASSIGNED',
            previousStatus: 'SEARCHING',
            newStatus: 'ASSIGNED',
            actorPublicId: user.publicId,
            metadata: JSON.stringify({ ambulancePublicId: ambulance.publicId }),
          },
        });
        const trip = await tx.trip.create({
          data: {
            publicId: randomUUID(),
            bookingId: booking.id,
            ambulanceId: ambulance.id,
            driverId: driver.id,
          },
        });
        const updatedBooking = await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'ASSIGNED' },
        });

        return {
          booking: updatedBooking,
          trip,
          previousStatus: booking.status,
          ambulancePublicId: ambulance.publicId,
          driverPublicId: driver.publicId,
          requesterId: booking.requesterId,
          requesterPublicId: booking.requester?.publicId ?? null,
          driverUserId: driver.id,
        };
      });
    } catch (error) {
      // A booking can only ever have one trip (unique bookingId). If two
      // dispatchers slip past the claim, surface a clean conflict, not a 500.
      if (isUniqueViolation(error)) {
        throw new ApiException(
          'CONFLICT',
          HttpStatus.CONFLICT,
          'This request already has an assigned crew',
        );
      }
      throw error;
    }

    // Side effects after commit: notifications, audit, live updates.
    await this.notifications
      .create(
        result.driverUserId,
        'ASSIGNMENT_RECEIVED',
        `You have a new assignment for booking ${result.booking.publicId}.`,
      )
      .catch(() => undefined);
    await this.notifications
      .create(
        result.requesterId,
        'AMBULANCE_ASSIGNED',
        `An ambulance has been assigned to your booking ${result.booking.publicId}.`,
      )
      .catch(() => undefined);

    this.audit.record({
      actorPublicId: user.publicId,
      action: 'AMBULANCE_ASSIGNED',
      resourceType: 'Booking',
      resourcePublicId: result.booking.publicId,
      requestId,
      result: 'SUCCESS',
    });

    this.realtime.publish(
      {
        userPublicIds: [result.driverPublicId, result.requesterPublicId].filter(
          (value): value is string => typeof value === 'string',
        ),
        roles: ['DISPATCHER', 'ADMIN', 'SUPER_ADMIN'],
      },
      {
        type: 'booking.assigned',
        bookingPublicId: result.booking.publicId,
        tripPublicId: result.trip.publicId,
        status: 'ASSIGNED',
        message: `Ambulance assigned to booking ${result.booking.publicId}.`,
      },
    );

    return {
      booking: mapBooking({ ...result.booking, requester: null, trip: null }),
      trip: mapTrip({
        publicId: result.trip.publicId,
        booking: { publicId: result.booking.publicId },
        ambulance: { publicId: result.ambulancePublicId },
        driver: { publicId: result.driverPublicId },
        acceptedAt: null,
        arrivedAt: null,
        onboardedAt: null,
        completedAt: null,
      }),
    };
  }

  /**
   * Dispatcher dashboard payload: fleet status counts plus active trips with
   * their latest GPS positions so the UI can render a live map.
   */
  async dashboard() {
    const ambulances = await this.prisma.ambulance.findMany({
      include: { driver: { select: { publicId: true, name: true } } },
    });

    const fleet = {
      total: ambulances.length,
      available: ambulances.filter((a) => a.status === 'AVAILABLE').length,
      onTrip: ambulances.filter((a) => a.status === 'ON_TRIP' || a.status === 'ASSIGNED').length,
      offDuty: ambulances.filter((a) => a.status !== 'AVAILABLE' && a.status !== 'ON_TRIP' && a.status !== 'ASSIGNED').length,
      vehicles: ambulances.map(mapAmbulance),
    };

    const ACTIVE_TRIP_STATUSES = [
      'ASSIGNED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'PATIENT_ONBOARD', 'IN_TRANSIT',
    ] as const;

    const activeBookings = await this.prisma.booking.findMany({
      where: { status: { in: [...ACTIVE_TRIP_STATUSES] } },
      include: {
        trip: {
          include: {
            locations: { orderBy: { recordedAt: 'desc' }, take: 1 },
            ambulance: { select: { publicId: true, registrationNumber: true, type: true } },
            driver: { select: { publicId: true, name: true } },
          },
        },
      },
    });

    const activeTrips = activeBookings
      .filter((b) => b.trip)
      .map((b) => {
        const trip = b.trip!;
        const latestLocation = trip.locations[0] ? mapTripLocation(trip.locations[0]) : undefined;
        return {
          bookingPublicId: b.publicId,
          status: b.status,
          urgency: b.urgency,
          pickup: { latitude: b.pickupLatitude, longitude: b.pickupLongitude, label: b.pickupLabel, address: b.pickupAddress },
          destination: b.destLatitude != null
            ? { latitude: b.destLatitude, longitude: b.destLongitude, label: b.destLabel, address: b.destAddress }
            : undefined,
          ambulance: trip.ambulance
            ? { publicId: trip.ambulance.publicId, registrationNumber: trip.ambulance.registrationNumber, type: trip.ambulance.type }
            : undefined,
          driver: trip.driver ? { publicId: trip.driver.publicId, name: trip.driver.name } : undefined,
          liveLocation: latestLocation,
        };
      });

    return { fleet, activeTrips };
  }
}

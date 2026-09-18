import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  assertTransition,
  type AmbulanceType,
  type AssignmentDecisionDto,
  type BookingView,
  type TripLocationDto,
  type TripLocationView,
  type TripStatusUpdateDto,
  type TripView,
} from '@abs/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ApiException } from '../common/errors/api-exception';
import { forbidden } from '../common/auth/role-sets';
import { mapBooking, mapTrip, mapTripLocation, type BookingRow, type TripRow } from '../common/mappers';
import { estimateMinutes, haversineKm, roundKm } from '../common/geo';
import type { AuthUser } from '../common/auth/auth-user';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';

const TRIP_STATUS_TO_BOOKING: Record<TripStatusUpdateDto['status'], TripStatusUpdateDto['status']> = {
  DRIVER_EN_ROUTE: 'DRIVER_EN_ROUTE',
  ARRIVED: 'ARRIVED',
  PATIENT_ONBOARD: 'PATIENT_ONBOARD',
  IN_TRANSIT: 'IN_TRANSIT',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
};

const OPERATOR_ROLES = new Set(['DISPATCHER', 'ADMIN', 'SUPER_ADMIN']);

/** Bookings whose trip can still receive telemetry. */
const TRACKABLE_STATUSES = new Set(['ASSIGNED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'PATIENT_ONBOARD', 'IN_TRANSIT']);

export interface TripWithBooking {
  trip: TripView;
  booking: BookingView;
  /** Vehicle identity, so the crew can confirm what they have been given. */
  vehicle: { registrationNumber: string; type: AmbulanceType };
}

export interface LiveTripProgress {
  location?: TripLocationView;
  distanceRemainingKm?: number;
  etaMinutes?: number;
}

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

  async mine(userPublicId: string): Promise<TripWithBooking[]> {
    const userId = await this.requireUserId(userPublicId);
    const trips = await this.prisma.trip.findMany({
      where: { driverId: userId },
      include: {
        booking: {
          include: { requester: { select: { publicId: true } } },
        },
        ambulance: { select: { publicId: true, registrationNumber: true, type: true } },
        driver: { select: { publicId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return trips.map((trip) => this.toTripWithBooking(trip));
  }

  async decide(
    tripPublicId: string,
    dto: AssignmentDecisionDto,
    user: AuthUser,
  ): Promise<TripWithBooking> {
    const trip = await this.prisma.trip.findUnique({
      where: { publicId: tripPublicId },
      include: {
        booking: true,
        ambulance: { select: { id: true } },
        driver: { select: { id: true, publicId: true } },
      },
    });
    if (!trip) {
      throw new ApiException('NOT_FOUND', HttpStatus.NOT_FOUND, 'Trip not found');
    }
    if (trip.driver.publicId !== user.publicId) {
      throw forbidden();
    }
    const booking = trip.booking;

    if (dto.decision === 'REJECTED') {
      // Rejection re-opens dispatch: ASSIGNED -> SEARCHING per RULES.md.
      if (booking.status !== 'ASSIGNED') {
        throw new ApiException(
          'INVALID_TRANSITION',
          HttpStatus.CONFLICT,
          `Assignment can only be rejected while the booking is ASSIGNED (current: ${booking.status})`,
        );
      }
      assertTransition('ASSIGNED', 'SEARCHING');

      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.trip.update({
          where: { id: trip.id },
          data: { rejectedAt: new Date(), rejectionReason: dto.reason ?? null },
        });
        await tx.ambulance.update({
          where: { id: trip.ambulance.id },
          data: { status: 'AVAILABLE' },
        });
        await tx.driverProfile.update({
          where: { userId: trip.driver.id },
          data: { availability: 'AVAILABLE' },
        });
        await tx.bookingEvent.create({
          data: {
            publicId: randomUUID(),
            bookingId: booking.id,
            type: 'ASSIGNMENT_REJECTED',
            previousStatus: 'ASSIGNED',
            newStatus: 'SEARCHING',
            actorPublicId: user.publicId,
            metadata: JSON.stringify({ reason: dto.reason ?? null }),
          },
        });
        return tx.booking.update({ where: { id: booking.id }, data: { status: 'SEARCHING' } });
      });

      await this.notifications
        .create(
          booking.requesterId,
          'REASSIGNMENT_IN_PROGRESS',
          `The assigned driver declined booking ${booking.publicId}. We are looking for another ambulance.`,
        )
        .catch(() => undefined);

      // Dispatch must see the request come back into the queue immediately.
      this.realtime.publishToOperators({
        type: 'trip.decision',
        bookingPublicId: booking.publicId,
        status: 'SEARCHING',
        message: `Crew declined booking ${booking.publicId} — awaiting reassignment.`,
      });

      return this.loadResult(updated.publicId);
    }

    // ACCEPTED
    if (booking.status !== 'ASSIGNED') {
      throw new ApiException(
        'INVALID_TRANSITION',
        HttpStatus.CONFLICT,
        `Assignment cannot be accepted while booking is ${booking.status}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.trip.update({
        where: { id: trip.id },
        data: { acceptedAt: new Date() },
      });
      await tx.driverProfile.update({
        where: { userId: trip.driver.id },
        data: { availability: 'ON_TRIP' },
      });
      await tx.bookingEvent.create({
        data: {
          publicId: randomUUID(),
          bookingId: booking.id,
          type: 'ASSIGNMENT_ACCEPTED',
          previousStatus: 'ASSIGNED',
          newStatus: 'ASSIGNED',
          actorPublicId: user.publicId,
          metadata: JSON.stringify({}),
        },
      });
    });

    await this.notifications
      .create(
        booking.requesterId,
        'DRIVER_ACCEPTED',
        `The driver accepted your booking ${booking.publicId} and is on the way.`,
      )
      .catch(() => undefined);

    this.realtime.publish(      {
        userPublicIds: [await this.requesterPublicId(booking.requesterId)],
        roles: ['DISPATCHER', 'ADMIN', 'SUPER_ADMIN'],
      },
      {
        type: 'trip.decision',
        bookingPublicId: booking.publicId,
        status: 'ASSIGNED',
        message: `Crew accepted booking ${booking.publicId}.`,
      },
    );

    return this.loadResult(booking.publicId);
  }

  async updateStatus(
    tripPublicId: string,
    dto: TripStatusUpdateDto,
    user: AuthUser,
  ): Promise<TripWithBooking> {
    const trip = await this.prisma.trip.findUnique({
      where: { publicId: tripPublicId },
      include: {
        booking: true,
        ambulance: { select: { id: true } },
        driver: { select: { id: true, publicId: true } },
      },
    });
    if (!trip) {
      throw new ApiException('NOT_FOUND', HttpStatus.NOT_FOUND, 'Trip not found');
    }
    if (trip.driver.publicId !== user.publicId) {
      throw forbidden();
    }
    const booking = trip.booking;
    const target = TRIP_STATUS_TO_BOOKING[dto.status];

    // Server-side transition validation.
    assertTransition(booking.status as Parameters<typeof assertTransition>[0], target);

    const data: Record<string, unknown> = {};
    if (dto.status === 'ARRIVED') data['arrivedAt'] = new Date();
    if (dto.status === 'PATIENT_ONBOARD') data['onboardedAt'] = new Date();
    if (dto.status === 'COMPLETED') data['completedAt'] = new Date();
    if (dto.status === 'FAILED') data['failedAt'] = new Date();

    const releasesVehicle = dto.status === 'COMPLETED' || dto.status === 'FAILED';

    const updatedBooking = await this.prisma.$transaction(async (tx) => {
      await tx.trip.update({ where: { id: trip.id }, data });
      if (releasesVehicle) {
        await tx.ambulance.update({
          where: { id: trip.ambulance.id },
          data: { status: 'AVAILABLE' },
        });
        await tx.driverProfile.update({
          where: { userId: trip.driver.id },
          data: { availability: 'AVAILABLE' },
        });
      }
      await tx.bookingEvent.create({
        data: {
          publicId: randomUUID(),
          bookingId: booking.id,
          type: dto.status === 'COMPLETED' ? 'BOOKING_COMPLETED' : 'TRIP_STATUS_CHANGED',
          previousStatus: booking.status,
          newStatus: target,
          actorPublicId: user.publicId,
          metadata: JSON.stringify({ tripPublicId: trip.publicId, note: dto.note ?? null }),
        },
      });
      return tx.booking.update({ where: { id: booking.id }, data: { status: target } });
    });

    if (dto.status === 'ARRIVED' || dto.status === 'COMPLETED') {
      const template = dto.status === 'ARRIVED' ? 'DRIVER_ARRIVED' : 'TRIP_COMPLETED';
      await this.notifications
        .create(
          booking.requesterId,
          template,
          `Booking ${booking.publicId}: trip status is now ${target}.`,
        )
        .catch(() => undefined);
    }

    this.realtime.publish(
      {
        userPublicIds: [trip.driver.publicId, await this.requesterPublicId(booking.requesterId)],
        roles: ['DISPATCHER', 'ADMIN', 'SUPER_ADMIN'],
      },
      {
        type: 'booking.status_changed',
        bookingPublicId: booking.publicId,
        tripPublicId: trip.publicId,
        status: target,
        message: `Trip status is now ${target}.`,
      },
    );

    return this.loadResult(updatedBooking.publicId);
  }

  /**
   * Records a driver position ping for an active trip and pushes it to the
   * people entitled to see it (the requester, operators, and the crew).
   */
  async recordLocation(
    tripPublicId: string,
    dto: TripLocationDto,
    user: AuthUser,
  ): Promise<LiveTripProgress> {
    const trip = await this.prisma.trip.findUnique({
      where: { publicId: tripPublicId },
      include: {
        booking: {
          select: {
            publicId: true,
            status: true,
            requesterId: true,
            pickupLatitude: true,
            pickupLongitude: true,
            destLatitude: true,
            destLongitude: true,
          },
        },
        driver: { select: { publicId: true, id: true } },
        ambulance: { select: { status: true } },
      },
    });
    if (!trip) {
      throw new ApiException('NOT_FOUND', HttpStatus.NOT_FOUND, 'Trip not found');
    }
    if (trip.driver.publicId !== user.publicId) {
      throw forbidden();
    }
    if (!TRACKABLE_STATUSES.has(trip.booking.status)) {
      throw new ApiException(
        'CONFLICT',
        HttpStatus.CONFLICT,
        `Location updates are only accepted while the trip is active (current: ${trip.booking.status})`,
      );
    }

    const row = await this.prisma.tripLocation.create({
      data: {
        tripId: trip.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        heading: dto.heading ?? null,
        speedKph: dto.speedKph ?? null,
      },
    });
    const location = mapTripLocation(row);

    // Progress towards the next milestone, so both the crew and the requester
    // see the same numbers the API reports on the booking detail endpoint.
    const headingToDestination =
      trip.booking.status === 'IN_TRANSIT' || trip.booking.status === 'PATIENT_ONBOARD';
    const milestone = headingToDestination
      ? { latitude: trip.booking.destLatitude, longitude: trip.booking.destLongitude }
      : { latitude: trip.booking.pickupLatitude, longitude: trip.booking.pickupLongitude };
    const distanceRemainingKm = roundKm(haversineKm(location, milestone));
    const etaMinutes = estimateMinutes(distanceRemainingKm, location.speedKph);

    this.realtime.publish(
      {
        userPublicIds: [trip.driver.publicId, await this.requesterPublicId(trip.booking.requesterId)],
        roles: ['DISPATCHER', 'ADMIN', 'SUPER_ADMIN'],
      },
      {
        type: 'trip.location',
        bookingPublicId: trip.booking.publicId,
        tripPublicId: trip.publicId,
        location,
      },
    );

    return { location, distanceRemainingKm, etaMinutes };
  }

  async findOne(tripPublicId: string, user: AuthUser): Promise<TripWithBooking> {
    const trip = await this.prisma.trip.findUnique({
      where: { publicId: tripPublicId },
      include: {
        booking: { include: { requester: { select: { publicId: true } } } },
        ambulance: { select: { publicId: true, registrationNumber: true, type: true } },
        driver: { select: { publicId: true } },
      },
    });
    if (!trip) {
      throw new ApiException('NOT_FOUND', HttpStatus.NOT_FOUND, 'Trip not found');
    }
    const allowed =
      trip.driver.publicId === user.publicId ||
      trip.booking.requester?.publicId === user.publicId ||
      OPERATOR_ROLES.has(user.role);
    if (!allowed) {
      throw forbidden();
    }
    return this.toTripWithBooking(trip);
  }

  private toTripWithBooking(trip: {
    publicId: string;
    booking: { publicId: string } & BookingRow;
    ambulance: { publicId: string; registrationNumber: string; type: string };
    driver: { publicId: string };
    acceptedAt: Date | null;
    arrivedAt: Date | null;
    onboardedAt: Date | null;
    completedAt: Date | null;
  }): TripWithBooking {
    return {
      trip: mapTrip(trip as TripRow),
      booking: mapBooking(trip.booking),
      vehicle: {
        registrationNumber: trip.ambulance.registrationNumber,
        type: trip.ambulance.type as AmbulanceType,
      },
    };
  }

  private async requesterPublicId(requesterId: string): Promise<string> {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { publicId: true },
    });
    return requester?.publicId ?? '';
  }

  private async loadResult(bookingPublicId: string): Promise<TripWithBooking> {
    const booking = await this.prisma.booking.findUnique({
      where: { publicId: bookingPublicId },
      include: {
        requester: { select: { publicId: true } },
        trip: {
          include: {
            booking: { select: { publicId: true } },
            ambulance: { select: { publicId: true, registrationNumber: true, type: true } },
            driver: { select: { publicId: true } },
          },
        },
      },
    });
    if (!booking || !booking.trip) {
      throw new ApiException('NOT_FOUND', HttpStatus.NOT_FOUND, 'Trip not found');
    }
    return { trip: mapTrip(booking.trip), booking: mapBooking(booking as BookingRow), vehicle: {
      registrationNumber: booking.trip.ambulance.registrationNumber,
      type: booking.trip.ambulance.type as AmbulanceType,
    } };
  }

  private async requireUserId(userPublicId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { publicId: userPublicId },
      select: { id: true },
    });
    if (!user) {
      throw new ApiException('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED, 'User no longer exists');
    }
    return user.id;
  }
}

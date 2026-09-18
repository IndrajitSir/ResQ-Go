import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  assertTransition,
  type BookingDetailView,
  type BookingView,
  type CancelBookingDto,
  type CreateBookingDto,
  type ListBookingsQuery,
  type Paginated,
  type SetDestinationDto,
  type UserRole,
} from '@abs/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ApiException } from '../common/errors/api-exception';
import { forbidden } from '../common/auth/role-sets';
import {
  mapAssignedCrew,
  mapBooking,
  mapBookingEvent,
  mapTrip,
  mapTripLocation,
} from '../common/mappers';
import { estimateMinutes, haversineKm, roundKm, type Coordinates } from '../common/geo';
import type { AuthUser } from '../common/auth/auth-user';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeService } from '../realtime/realtime.service';

const OPERATOR_ROLES = ['DISPATCHER', 'ADMIN', 'SUPER_ADMIN'] as const satisfies readonly UserRole[];
const OPERATOR_ROLE_SET = new Set<string>(OPERATOR_ROLES);

/** Booking statuses at which an operator may still cancel and release the crew. */
const RELEASABLE_STATUSES = new Set(['ASSIGNED', 'DRIVER_EN_ROUTE', 'ARRIVED']);

/** Statuses in which the destination may still be corrected by dispatch. */
const DESTINATION_EDITABLE_STATUSES = new Set([
  'REQUESTED',
  'SEARCHING',
  'ASSIGNED',
  'DRIVER_EN_ROUTE',
  'ARRIVED',
]);

/** Placeholder used when an emergency request is raised before a facility is known. */
const PENDING_DESTINATION_LABEL = 'Receiving hospital to be confirmed';
const PENDING_DESTINATION_ADDRESS = 'Dispatch will confirm the receiving facility';

/** Includes used everywhere a booking is read so the mappers get complete rows. */
const TRIP_INCLUDE = {
  ambulance: { select: { id: true, publicId: true, registrationNumber: true, type: true, status: true } },
  driver: {
    select: {
      id: true,
      publicId: true,
      name: true,
      phone: true,
      driverProfile: { select: { availability: true } },
    },
  },
  locations: { orderBy: { recordedAt: 'desc' }, take: 1 },
} as const;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
  ) {}

  async create(dto: CreateBookingDto, user: AuthUser, requestId: string): Promise<BookingView> {
    if (user.role !== 'PATIENT') {
      throw forbidden();
    }

    const requester = await this.prisma.user.findUnique({
      where: { publicId: user.publicId },
      select: { id: true },
    });
    if (!requester) {
      throw new ApiException(
        'UNAUTHENTICATED',
        HttpStatus.UNAUTHORIZED,
        'User no longer exists',
      );
    }

    const existingRecord = await this.prisma.idempotencyRecord.findUnique({
      where: { key: dto.idempotencyKey },
    });
    if (existingRecord) {
      if (existingRecord.status === 'COMPLETED' && existingRecord.responseJson) {
        return JSON.parse(existingRecord.responseJson) as BookingView;
      }
      throw new ApiException(
        'IDEMPOTENCY_REPLAY_IN_PROGRESS',
        HttpStatus.CONFLICT,
        'A request with this idempotency key is already in progress',
      );
    }

    await this.prisma.idempotencyRecord.create({
      data: {
        key: dto.idempotencyKey,
        userPublicId: user.publicId,
        status: 'IN_PROGRESS',
      },
    });

    const isEmergency = dto.urgency === 'EMERGENCY';
    // Emergency requests arrive with coordinates only; the API fills in honest
    // placeholders so dispatch can see the request immediately (RULES.md lets
    // only emergency requests omit a described location).
    const pickupLabel = dto.pickup.label ?? (isEmergency ? 'Device location' : 'Pickup');
    const pickupAddress =
      dto.pickup.address ?? `${dto.pickup.latitude.toFixed(5)}, ${dto.pickup.longitude.toFixed(5)}`;
    const destinationPending = !dto.destination;
    const destinationLabel = dto.destination?.label ?? PENDING_DESTINATION_LABEL;
    const destinationAddress = dto.destination?.address ?? PENDING_DESTINATION_ADDRESS;
    const destinationLatitude = dto.destination?.latitude ?? dto.pickup.latitude;
    const destinationLongitude = dto.destination?.longitude ?? dto.pickup.longitude;

    try {
      const booking = await this.prisma.$transaction(async (tx) => {
        const created = await tx.booking.create({
          data: {
            publicId: randomUUID(),
            requesterId: requester.id,
            pickupLabel,
            pickupAddress,
            pickupLatitude: dto.pickup.latitude,
            pickupLongitude: dto.pickup.longitude,
            destLabel: destinationLabel,
            destAddress: destinationAddress,
            destLatitude: destinationLatitude,
            destLongitude: destinationLongitude,
            requiredAmbulanceType: dto.requiredAmbulanceType,
            urgency: dto.urgency,
            notes: dto.notes ?? null,
            status: 'REQUESTED',
            destinationPending,
            idempotencyKey: dto.idempotencyKey,
          },
        });
        await tx.bookingEvent.create({
          data: {
            publicId: randomUUID(),
            bookingId: created.id,
            type: 'BOOKING_CREATED',
            newStatus: 'REQUESTED',
            actorPublicId: user.publicId,
            metadata: JSON.stringify({ urgency: dto.urgency, destinationPending }),
          },
        });
        return created;
      });

      const view = mapBooking({ ...booking, requester: { publicId: user.publicId }, trip: null });

      await this.prisma.idempotencyRecord.update({
        where: { key: dto.idempotencyKey },
        data: { status: 'COMPLETED', responseJson: JSON.stringify(view) },
      });

      // Notifications are best-effort side effects, outside the booking transaction.
      await this.notifications
        .create(
          requester.id,
          isEmergency ? 'EMERGENCY_BOOKING_RAISED' : 'BOOKING_CONFIRMED',
          isEmergency
            ? `Emergency request ${view.publicId} received. Dispatch is assigning the closest ambulance — keep your phone reachable.`
            : `Your booking ${view.publicId} has been received.`,
        )
        .catch(() => undefined);

      // Dispatch consoles learn about the request immediately.
      this.realtime.publishToOperators({
        type: 'booking.status_changed',
        bookingPublicId: view.publicId,
        status: view.status,
        message: isEmergency
          ? `Emergency request ${view.publicId} needs an ambulance now.`
          : `New request ${view.publicId}.`,
      });

      this.audit.record({
        actorPublicId: user.publicId,
        action: 'BOOKING_CREATED',
        resourceType: 'Booking',
        resourcePublicId: view.publicId,
        requestId,
        result: 'SUCCESS',
      });

      return view;
    } catch (error) {
      await this.prisma.idempotencyRecord
        .update({ where: { key: dto.idempotencyKey }, data: { status: 'FAILED' } })
        .catch(() => undefined);
      throw error;
    }
  }

  async list(query: ListBookingsQuery, user: AuthUser): Promise<Paginated<BookingView>> {
    const where: { status?: string; requester?: { publicId: string } } = {};
    if (query.status) {
      where.status = query.status;
    }
    if (!OPERATOR_ROLE_SET.has(user.role)) {
      where.requester = { publicId: user.publicId };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        include: {
          requester: { select: { publicId: true } },
          trip: {
            include: {
              ambulance: { select: { publicId: true } },
              driver: { select: { publicId: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      items: rows.map((row) => mapBooking(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  /**
   * Full booking detail. Visible to the requester, the assigned crew, and
   * operators only — nobody else learns that the booking exists.
   */
  async findOne(publicId: string, user: AuthUser): Promise<BookingDetailView> {
    const row = await this.prisma.booking.findUnique({
      where: { publicId },
      include: {
        requester: { select: { publicId: true } },
        trip: { include: TRIP_INCLUDE },
      },
    });
    if (!row) {
      throw notFound();
    }

    const isRequester = row.requester?.publicId === user.publicId;
    const isAssignedDriver = row.trip?.driver.publicId === user.publicId;
    if (!isRequester && !isAssignedDriver && !OPERATOR_ROLE_SET.has(user.role)) {
      // Do not leak the existence of other people's bookings.
      throw notFound();
    }

    const detail: BookingDetailView = { booking: mapBooking(row) };
    if (row.trip) {
      detail.trip = mapTrip(row.trip);
      detail.crew = mapAssignedCrew({
        driver: row.trip.driver,
        ambulance: row.trip.ambulance,
      });
      const latest = row.trip.locations[0];
      if (latest) {
        const liveLocation = mapTripLocation(latest);
        detail.liveLocation = liveLocation;
        const milestone = this.nextMilestone(
          row.status,
          { latitude: row.pickupLatitude, longitude: row.pickupLongitude },
          { latitude: row.destLatitude, longitude: row.destLongitude },
        );
        const distanceKm = roundKm(haversineKm(liveLocation, milestone));
        detail.distanceRemainingKm = distanceKm;
        detail.etaMinutes = estimateMinutes(distanceKm, liveLocation.speedKph);
      }
    }
    return detail;
  }

  /**
   * Dispatch confirms the receiving facility for bookings that were raised
   * before one was known (typically emergency requests).
   */
  async setDestination(
    publicId: string,
    dto: SetDestinationDto,
    user: AuthUser,
    requestId: string,
  ): Promise<BookingView> {
    if (!OPERATOR_ROLE_SET.has(user.role)) {
      throw forbidden();
    }

    const row = await this.prisma.booking.findUnique({
      where: { publicId },
      include: {
        requester: { select: { id: true, publicId: true } },
        trip: { include: { driver: { select: { publicId: true } } } },
      },
    });
    if (!row) {
      throw notFound();
    }
    if (!DESTINATION_EDITABLE_STATUSES.has(row.status)) {
      throw new ApiException(
        'CONFLICT',
        HttpStatus.CONFLICT,
        `The destination cannot be changed while the booking is ${row.status}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.update({
        where: { id: row.id },
        data: {
          destLabel: dto.destination.label,
          destAddress: dto.destination.address,
          destLatitude: dto.destination.latitude,
          destLongitude: dto.destination.longitude,
          destinationPending: false,
        },
      });
      await tx.bookingEvent.create({
        data: {
          publicId: randomUUID(),
          bookingId: row.id,
          type: 'STATUS_CHANGED',
          previousStatus: row.status,
          newStatus: row.status,
          actorPublicId: user.publicId,
          metadata: JSON.stringify({ destination: dto.destination.label }),
        },
      });
      return booking;
    });

    this.realtime.publish(
      {
        userPublicIds: [
          row.requester?.publicId,
          row.trip?.driver.publicId,
        ].filter((value): value is string => typeof value === 'string'),
      },
      {
        type: 'booking.destination_set',
        bookingPublicId: row.publicId,
        status: updated.status as BookingView['status'],
        message: `Destination confirmed: ${dto.destination.label}`,
      },
    );

    if (row.requester) {
      await this.notifications
        .create(
          row.requester.id,
          'DESTINATION_CONFIRMED',
          `Your booking ${row.publicId} is heading to ${dto.destination.label}.`,
        )
        .catch(() => undefined);
    }

    this.audit.record({
      actorPublicId: user.publicId,
      action: 'BOOKING_DESTINATION_SET',
      resourceType: 'Booking',
      resourcePublicId: row.publicId,
      requestId,
      result: 'SUCCESS',
    });

    return mapBooking({ ...updated, requester: row.requester, trip: null });
  }

  async cancel(
    publicId: string,
    dto: CancelBookingDto,
    user: AuthUser,
    requestId: string,
  ): Promise<BookingView> {
    const row = await this.prisma.booking.findUnique({
      where: { publicId },
      include: {
        requester: { select: { id: true, publicId: true } },
        trip: {
          include: {
            ambulance: { select: { id: true, publicId: true } },
            driver: { select: { id: true, publicId: true } },
          },
        },
      },
    });
    if (!row) {
      throw notFound();
    }

    let targetStatus: 'CANCELLED_BY_PATIENT' | 'CANCELLED_BY_OPERATOR';
    if (user.role === 'PATIENT') {
      if (row.requester?.publicId !== user.publicId) {
        throw notFound();
      }
      targetStatus = 'CANCELLED_BY_PATIENT';
    } else if (OPERATOR_ROLE_SET.has(user.role)) {
      targetStatus = 'CANCELLED_BY_OPERATOR';
    } else {
      throw forbidden();
    }

    // Server-side transition validation (also rejects IN_TRANSIT or later).
    assertTransition(row.status as Parameters<typeof assertTransition>[0], targetStatus);

    const shouldRelease =
      row.trip !== null &&
      RELEASABLE_STATUSES.has(row.status) &&
      targetStatus === 'CANCELLED_BY_OPERATOR';

    const updated = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.update({
        where: { id: row.id },
        data: {
          status: targetStatus,
          cancellationReason: dto.reason,
          cancellationDetails: dto.details ?? null,
        },
      });
      await tx.bookingEvent.create({
        data: {
          publicId: randomUUID(),
          bookingId: row.id,
          type: 'BOOKING_CANCELLED',
          previousStatus: row.status,
          newStatus: targetStatus,
          actorPublicId: user.publicId,
          metadata: JSON.stringify({ reason: dto.reason }),
        },
      });
      if (shouldRelease && row.trip) {
        await tx.ambulance.update({
          where: { id: row.trip.ambulance.id },
          data: { status: 'AVAILABLE' },
        });
        await tx.driverProfile.update({
          where: { userId: row.trip.driver.id },
          data: { availability: 'AVAILABLE' },
        });
      }
      return booking;
    });

    if (row.requester) {
      await this.notifications
        .create(
          row.requester.id,
          'BOOKING_CANCELLED',
          `Your booking ${row.publicId} was cancelled (${dto.reason}).`,
        )
        .catch(() => undefined);
    }

    this.realtime.publish(
      {
        userPublicIds: [row.requester?.publicId, row.trip?.driver.publicId].filter(
          (value): value is string => typeof value === 'string',
        ),
        roles: OPERATOR_ROLES,
      },
      {
        type: 'booking.status_changed',
        bookingPublicId: row.publicId,
        status: targetStatus,
        message: `Booking ${row.publicId} was cancelled.`,
      },
    );

    this.audit.record({
      actorPublicId: user.publicId,
      action: 'BOOKING_CANCELLED',
      resourceType: 'Booking',
      resourcePublicId: row.publicId,
      requestId,
      result: 'SUCCESS',
    });

    return mapBooking({ ...updated, requester: row.requester, trip: row.trip });
  }

  async listEvents(publicId: string, user: AuthUser): Promise<Array<ReturnType<typeof mapBookingEvent>>> {
    // Same access rule as the detail endpoint.
    const row = await this.prisma.booking.findUnique({
      where: { publicId },
      select: {
        id: true,
        requester: { select: { publicId: true } },
        trip: { select: { driver: { select: { publicId: true } } } },
      },
    });
    if (!row) {
      throw notFound();
    }
    const isRequester = row.requester?.publicId === user.publicId;
    const isAssignedDriver = row.trip?.driver.publicId === user.publicId;
    if (!isRequester && !isAssignedDriver && !OPERATOR_ROLE_SET.has(user.role)) {
      throw notFound();
    }
    const events = await this.prisma.bookingEvent.findMany({
      where: { bookingId: row.id },
      orderBy: { createdAt: 'asc' },
    });
    return events.map((event) => mapBookingEvent(event));
  }

  /**
   * Where the vehicle is heading next: the pickup until the patient is on
   * board, then the receiving facility.
   */
  private nextMilestone(status: string, pickup: Coordinates, destination: Coordinates): Coordinates {
    return status === 'IN_TRANSIT' || status === 'PATIENT_ONBOARD' ? destination : pickup;
  }
}

function notFound(): ApiException {
  return new ApiException(
    'NOT_FOUND',
    HttpStatus.NOT_FOUND,
    'Booking not found',
  );
}

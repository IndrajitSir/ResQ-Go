import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  assertTransition,
  type BookingView,
  type CancelBookingDto,
  type CreateBookingDto,
  type ListBookingsQuery,
  type TripView,
} from '@abs/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ApiException } from '../common/errors/api-exception';
import { forbidden } from '../common/auth/role-sets';
import { mapBooking, mapBookingEvent, mapTrip, type BookingRow } from '../common/mappers';
import type { AuthUser } from '../common/auth/auth-user';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

const OPERATOR_ROLES = new Set(['DISPATCHER', 'ADMIN', 'SUPER_ADMIN']);

/** Booking statuses at which an operator may still cancel and release the crew. */
const RELEASABLE_STATUSES = new Set(['ASSIGNED', 'DRIVER_EN_ROUTE', 'ARRIVED']);

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
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
        publicId: randomUUID(),
        key: dto.idempotencyKey,
        userPublicId: user.publicId,
        status: 'IN_PROGRESS',
      },
    });

    try {
      const booking = await this.prisma.$transaction(async (tx) => {
        const created = await tx.booking.create({
          data: {
            publicId: randomUUID(),
            requesterId: requester.id,
            pickupLabel: dto.pickup.label,
            pickupAddress: dto.pickup.address,
            pickupLatitude: dto.pickup.latitude,
            pickupLongitude: dto.pickup.longitude,
            destLabel: dto.destination.label,
            destAddress: dto.destination.address,
            destLatitude: dto.destination.latitude,
            destLongitude: dto.destination.longitude,
            requiredAmbulanceType: dto.requiredAmbulanceType,
            urgency: dto.urgency,
            notes: dto.notes ?? null,
            status: 'REQUESTED',
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
            metadata: JSON.stringify({}),
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
        .create(requester.id, 'BOOKING_CONFIRMED', `Your booking ${view.publicId} has been received.`)
        .catch(() => undefined);

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

  async list(query: ListBookingsQuery, user: AuthUser) {
    const where: { status?: string; requester?: { publicId: string } } = {};
    if (query.status) {
      where.status = query.status;
    }
    if (!OPERATOR_ROLES.has(user.role)) {
      where.requester = { publicId: user.publicId };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        include: {
          requester: { select: { publicId: true } },
          trip: { include: { ambulance: { select: { publicId: true } }, driver: { select: { publicId: true } } } },
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

  async findOne(publicId: string, user: AuthUser): Promise<{ booking: BookingView; trip?: TripView }> {
    const row = await this.prisma.booking.findUnique({
      where: { publicId },
      include: {
        requester: { select: { publicId: true } },
        trip: {
          include: {
            booking: { select: { publicId: true } },
            ambulance: true,
            driver: true,
          },
        },
      },
    });
    if (!row) {
      throw notFound();
    }
    if (user.role === 'PATIENT' && row.requester?.publicId !== user.publicId) {
      // Do not leak the existence of other patients' bookings.
      throw notFound();
    }
    const trip = row.trip ? mapTrip(row.trip) : undefined;
    return {
      booking: mapBooking(row),
      ...(trip ? { trip } : {}),
    };
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
        trip: { include: { ambulance: { select: { publicId: true } }, driver: { select: { publicId: true } } } },
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
    } else if (OPERATOR_ROLES.has(user.role)) {
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
      select: { id: true, requester: { select: { publicId: true } } },
    });
    if (!row) {
      throw notFound();
    }
    if (user.role === 'PATIENT' && row.requester?.publicId !== user.publicId) {
      throw notFound();
    }
    const events = await this.prisma.bookingEvent.findMany({
      where: { bookingId: row.id },
      orderBy: { createdAt: 'asc' },
    });
    return events.map((event) => mapBookingEvent(event));
  }
}

function notFound(): ApiException {
  return new ApiException(
    'NOT_FOUND',
    HttpStatus.NOT_FOUND,
    'Booking not found',
  );
}

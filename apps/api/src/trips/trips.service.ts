import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  assertTransition,
  type AssignmentDecisionDto,
  type BookingView,
  type TripStatusUpdateDto,
  type TripView,
} from '@abs/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ApiException } from '../common/errors/api-exception';
import { forbidden } from '../common/auth/role-sets';
import { mapBooking, mapTrip, type BookingRow, type TripRow } from '../common/mappers';
import type { AuthUser } from '../common/auth/auth-user';
import { NotificationsService } from '../notifications/notifications.service';

const TRIP_STATUS_TO_BOOKING: Record<TripStatusUpdateDto['status'], TripStatusUpdateDto['status']> = {
  DRIVER_EN_ROUTE: 'DRIVER_EN_ROUTE',
  ARRIVED: 'ARRIVED',
  PATIENT_ONBOARD: 'PATIENT_ONBOARD',
  IN_TRANSIT: 'IN_TRANSIT',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
};

const OPERATOR_ROLES = new Set(['DISPATCHER', 'ADMIN', 'SUPER_ADMIN']);

export interface TripWithBooking {
  trip: TripView;
  booking: BookingView;
}

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async mine(userPublicId: string): Promise<TripWithBooking[]> {
    const userId = await this.requireUserId(userPublicId);
    const trips = await this.prisma.trip.findMany({
      where: { driverId: userId },
      include: {
        booking: {
          include: { requester: { select: { publicId: true } } },
        },
        ambulance: { select: { publicId: true } },
        driver: { select: { publicId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return trips.map((trip) => ({
      trip: mapTrip(trip),
      booking: mapBooking(trip.booking),
    }));
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
        driver: { select: { id: true } },
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
        driver: { select: { id: true } },
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
          type: 'TRIP_STATUS_CHANGED',
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

    return this.loadResult(updatedBooking.publicId);
  }

  async findOne(tripPublicId: string, user: AuthUser): Promise<TripWithBooking> {
    const trip = await this.prisma.trip.findUnique({
      where: { publicId: tripPublicId },
      include: {
        booking: { include: { requester: { select: { publicId: true } } } },
        ambulance: { select: { publicId: true } },
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
    return { trip: mapTrip(trip), booking: mapBooking(trip.booking) };
  }

  private async loadResult(bookingPublicId: string): Promise<TripWithBooking> {
    const booking = await this.prisma.booking.findUnique({
      where: { publicId: bookingPublicId },
      include: {
        requester: { select: { publicId: true } },
        trip: {
          include: {
            booking: { select: { publicId: true } },
            ambulance: { select: { publicId: true } },
            driver: { select: { publicId: true } },
          },
        },
      },
    });
    if (!booking || !booking.trip) {
      throw new ApiException('NOT_FOUND', HttpStatus.NOT_FOUND, 'Trip not found');
    }
    const tripRow: TripRow = booking.trip;
    return {
      trip: mapTrip(tripRow),
      booking: mapBooking(booking as BookingRow),
    };
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

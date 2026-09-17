import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { assertTransition, type AssignAmbulanceDto, type BookingView, type TripView } from '@abs/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ApiException } from '../common/errors/api-exception';
import { mapAmbulance, mapBooking, mapTrip } from '../common/mappers';
import type { AuthUser } from '../common/auth/auth-user';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

const QUEUE_STATUSES = ['REQUESTED', 'SEARCHING'] as const;

@Injectable()
export class DispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async queue(): Promise<BookingView[]> {
    const rows = await this.prisma.booking.findMany({
      where: { status: { in: [...QUEUE_STATUSES] } },
      include: {
        requester: { select: { publicId: true } },
        trip: { include: { ambulance: { select: { publicId: true } }, driver: { select: { publicId: true } } } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return rows.map((row) => mapBooking(row));
  }

  async eligible(bookingPublicId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { publicId: bookingPublicId },
      select: { requiredAmbulanceType: true },
    });
    if (!booking) {
      throw new ApiException('NOT_FOUND', HttpStatus.NOT_FOUND, 'Booking not found');
    }
    const ambulances = await this.prisma.ambulance.findMany({
      where: { status: 'AVAILABLE', type: booking.requiredAmbulanceType },
      orderBy: { createdAt: 'asc' },
    });
    return ambulances.map((row) => mapAmbulance(row));
  }

  async assign(
    bookingPublicId: string,
    dto: AssignAmbulanceDto,
    user: AuthUser,
    requestId: string,
  ): Promise<{ booking: BookingView; trip: TripView }> {
    const result = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { publicId: bookingPublicId } });
      if (!booking) {
        throw new ApiException('NOT_FOUND', HttpStatus.NOT_FOUND, 'Booking not found');
      }
      if (booking.status !== 'REQUESTED') {
        throw new ApiException(
          'CONFLICT',
          HttpStatus.CONFLICT,
          `Booking cannot be assigned in status ${booking.status}`,
        );
      }

      const ambulance = await tx.ambulance.findUnique({
        where: { publicId: dto.ambulanceId },
        include: {
          driver: { include: { driverProfile: true } },
        },
      });
      if (!ambulance) {
        throw new ApiException('NOT_FOUND', HttpStatus.NOT_FOUND, 'Ambulance not found');
      }

      // Double-assignment guard: atomic conditional update inside the transaction.
      const guard = await tx.ambulance.updateMany({
        where: { id: ambulance.id, status: 'AVAILABLE' },
        data: { status: 'ON_TRIP' },
      });
      if (guard.count === 0) {
        throw new ApiException(
          'CONFLICT',
          HttpStatus.CONFLICT,
          'Ambulance no longer available',
        );
      }

      const driver = ambulance.driver;
      const profile = driver?.driverProfile;
      if (
        !driver ||
        !profile ||
        profile.availability !== 'AVAILABLE' ||
        profile.identityVerification !== 'VERIFIED'
      ) {
        throw new ApiException(
          'CONFLICT',
          HttpStatus.CONFLICT,
          'Driver is not available or not verified for assignment',
        );
      }

      assertTransition(booking.status as Parameters<typeof assertTransition>[0], 'SEARCHING');
      assertTransition('SEARCHING', 'ASSIGNED');

      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'ASSIGNED' },
      });
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
      return { booking: updatedBooking, trip, ambulancePublicId: ambulance.publicId, driverPublicId: driver.publicId, bookingId: booking.id, requesterId: booking.requesterId, driverUserId: driver.id };
    });

    // Notifications after commit (best-effort).
    await this.notifications
      .create(result.driverUserId, 'ASSIGNMENT_RECEIVED', `You have a new assignment for booking ${result.booking.publicId}.`)
      .catch(() => undefined);
    await this.notifications
      .create(result.requesterId, 'AMBULANCE_ASSIGNED', `An ambulance has been assigned to your booking ${result.booking.publicId}.`)
      .catch(() => undefined);
    this.audit.record({
      actorPublicId: user.publicId,
      action: 'AMBULANCE_ASSIGNED',
      resourceType: 'Booking',
      resourcePublicId: result.booking.publicId,
      requestId,
      result: 'SUCCESS',
    });

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
}

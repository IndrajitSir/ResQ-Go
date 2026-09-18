import { HttpStatus } from '@nestjs/common';
import { InvalidTransitionError, type BookingView } from '@abs/contracts';
import { BookingsService } from './bookings.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { AuditService } from '../audit/audit.service';
import type { RealtimeService } from '../realtime/realtime.service';
import type { AuthUser } from '../common/auth/auth-user';

/**
 * Minimal structural stub of PrismaService. Each test configures only the
 * delegate methods its scenario touches.
 */
function createPrismaStub(): {
  stub: Record<string, unknown>;
  prisma: PrismaService;
} {
  const stub: Record<string, unknown> = {
    // The service resolves the requester before touching idempotency state, so the
    // stub returns a real user unless a test overrides it.
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'u1', publicId: 'patient-a' }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'u1', publicId: 'patient-a' }),
    },
    idempotencyRecord: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    booking: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    bookingEvent: { create: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  return { stub, prisma: stub as unknown as PrismaService };
}

const notificationsMock = {
  create: jest.fn().mockResolvedValue(undefined),
} as unknown as NotificationsService;

const auditMock = {
  record: jest.fn(),
  list: jest.fn(),
} as unknown as AuditService;

const realtimeMock = {
  publish: jest.fn(),
  publishToOperators: jest.fn(),
  streamFor: jest.fn(),
} as unknown as RealtimeService;

const patientUser: AuthUser = { publicId: 'patient-a', role: 'PATIENT' };
const otherPatientUser: AuthUser = { publicId: 'patient-b', role: 'PATIENT' };

function bookingRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'bk-1',
    publicId: 'booking-1',
    status: 'REQUESTED',
    urgency: 'URGENT',
    pickupLabel: 'Home',
    pickupAddress: '12 Main Street',
    pickupLatitude: 12.9,
    pickupLongitude: 77.5,
    destLabel: 'Hospital',
    destAddress: '100 Hospital Road',
    destLatitude: 13.0,
    destLongitude: 77.6,
    requiredAmbulanceType: 'BLS',
    notes: null,
    cancellationReason: null,
    cancellationDetails: null,
    requester: { id: 'u1', publicId: 'patient-a' },
    trip: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('BookingsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findOne ownership', () => {
    it('returns NOT_FOUND when a patient requests another patient\'s booking', async () => {
      const { stub, prisma } = createPrismaStub();
      // The booking belongs to patient-b; patient-a must not be able to read it.
      (stub['booking'] as { findUnique: jest.Mock }).findUnique.mockResolvedValue(
        bookingRow({ requester: { id: 'u2', publicId: otherPatientUser.publicId } }),
      );
      const service = new BookingsService(prisma, notificationsMock, auditMock, realtimeMock);

      await expect(service.findOne('booking-1', patientUser)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('allows the owning patient to view their booking', async () => {
      const { stub, prisma } = createPrismaStub();
      (stub['booking'] as { findUnique: jest.Mock }).findUnique.mockResolvedValue(bookingRow());
      const service = new BookingsService(prisma, notificationsMock, auditMock, realtimeMock);

      const result = await service.findOne('booking-1', patientUser);
      expect(result.booking.publicId).toBe('booking-1');
    });
  });

  describe('idempotent booking creation', () => {
    it('returns the stored response for a COMPLETED idempotency record without creating a booking', async () => {
      const { stub, prisma } = createPrismaStub();
      const storedView: BookingView = {
        publicId: 'booking-1',
        status: 'REQUESTED',
        urgency: 'URGENT',
        pickup: { label: 'Home', address: '12 Main Street', latitude: 12.9, longitude: 77.5 },
        destination: { label: 'Hospital', address: '100 Hospital Road', latitude: 13.0, longitude: 77.6 },
        requiredAmbulanceType: 'BLS',
        requesterPublicId: 'patient-a',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      (stub['idempotencyRecord'] as { findUnique: jest.Mock }).findUnique.mockResolvedValue({
        key: 'key-1',
        status: 'COMPLETED',
        responseJson: JSON.stringify(storedView),
      });
      const service = new BookingsService(prisma, notificationsMock, auditMock, realtimeMock);

      const dto = {
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
        pickup: { label: 'Home', address: '12 Main Street', latitude: 12.9, longitude: 77.5 },
        destination: { label: 'Hospital', address: '100 Hospital Road', latitude: 13.0, longitude: 77.6 },
        requiredAmbulanceType: 'BLS' as const,
        urgency: 'URGENT' as const,
      };

      const result = await service.create(dto, patientUser, 'req-1');
      expect(result).toEqual(storedView);
      expect(stub['$transaction']).not.toHaveBeenCalled();
      expect((stub['booking'] as { create: jest.Mock }).create).not.toHaveBeenCalled();
    });

    it('throws IDEMPOTENCY_REPLAY_IN_PROGRESS when the record is IN_PROGRESS', async () => {
      const { stub, prisma } = createPrismaStub();
      (stub['idempotencyRecord'] as { findUnique: jest.Mock }).findUnique.mockResolvedValue({
        key: 'key-1',
        status: 'IN_PROGRESS',
        responseJson: null,
      });
      const service = new BookingsService(prisma, notificationsMock, auditMock, realtimeMock);

      const dto = {
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
        pickup: { label: 'Home', address: '12 Main Street', latitude: 12.9, longitude: 77.5 },
        destination: { label: 'Hospital', address: '100 Hospital Road', latitude: 13.0, longitude: 77.6 },
        requiredAmbulanceType: 'BLS' as const,
        urgency: 'URGENT' as const,
      };

      await expect(service.create(dto, patientUser, 'req-1')).rejects.toMatchObject({
        code: 'IDEMPOTENCY_REPLAY_IN_PROGRESS',
        status: HttpStatus.CONFLICT,
      });
    });
  });

  describe('cancel', () => {
    it('rejects cancellation of an IN_TRANSIT booking as an invalid transition', async () => {
      const { stub, prisma } = createPrismaStub();
      (stub['booking'] as { findUnique: jest.Mock }).findUnique.mockResolvedValue(
        bookingRow({
          status: 'IN_TRANSIT',
          trip: {
            publicId: 'trip-1',
            ambulance: { id: 'am-1', publicId: 'amb-1' },
            driver: { id: 'd1', publicId: 'driver-1' },
          },
        }),
      );
      const service = new BookingsService(prisma, notificationsMock, auditMock, realtimeMock);

      await expect(
        service.cancel(
          'booking-1',
          { reason: 'NO_LONGER_NEEDED' },
          patientUser,
          'req-1',
        ),
      ).rejects.toBeInstanceOf(InvalidTransitionError);
      expect(stub['$transaction']).not.toHaveBeenCalled();
    });
  });
});

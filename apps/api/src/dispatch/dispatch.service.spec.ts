import { HttpStatus } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/auth/auth-user';

function createPrismaStub(): { stub: Record<string, unknown>; prisma: PrismaService } {
  const stub: Record<string, unknown> = {
    booking: { findUnique: jest.fn(), findMany: jest.fn() },
    ambulance: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    bookingEvent: { create: jest.fn() },
    trip: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  return { stub, prisma: stub as unknown as PrismaService };
}

const notificationsMock = {
  create: jest.fn().mockResolvedValue(undefined),
} as unknown as NotificationsService;

const auditMock = { record: jest.fn(), list: jest.fn() } as unknown as AuditService;

const dispatcherUser: AuthUser = { publicId: 'dispatcher-1', role: 'DISPATCHER' };

const dto = { ambulanceId: '11111111-1111-4111-8111-111111111111' };

function bookingRow(status: string): Record<string, unknown> {
  return {
    id: 'bk-1',
    publicId: 'booking-1',
    status,
    requesterId: 'u1',
  };
}

function ambulanceRow(driverProfile?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'am-1',
    publicId: 'amb-1',
    status: 'AVAILABLE',
    driver: driverProfile
      ? { id: 'd1', publicId: 'driver-1', driverProfile }
      : null,
  };
}

describe('DispatchService.assign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws CONFLICT when the ambulance availability guard matches zero rows (double assignment)', async () => {
    const { stub, prisma } = createPrismaStub();
    (stub['booking'] as { findUnique: jest.Mock }).findUnique.mockResolvedValue(
      bookingRow('REQUESTED'),
    );
    (stub['ambulance'] as { findUnique: jest.Mock }).findUnique.mockResolvedValue(
      ambulanceRow({ availability: 'AVAILABLE', identityVerification: 'VERIFIED' }),
    );
    (stub['ambulance'] as { updateMany: jest.Mock }).updateMany.mockResolvedValue({ count: 0 });
    (stub['$transaction'] as jest.Mock).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(stub),
    );
    const service = new DispatchService(prisma, notificationsMock, auditMock);

    await expect(
      service.assign('booking-1', dto, dispatcherUser, 'req-1'),
    ).rejects.toMatchObject({ code: 'CONFLICT', status: HttpStatus.CONFLICT });
    expect((stub['trip'] as { create: jest.Mock }).create).not.toHaveBeenCalled();
  });

  it('rejects assignment when the booking is already ASSIGNED', async () => {
    const { stub, prisma } = createPrismaStub();
    (stub['booking'] as { findUnique: jest.Mock }).findUnique.mockResolvedValue(
      bookingRow('ASSIGNED'),
    );
    const service = new DispatchService(prisma, notificationsMock, auditMock);

    await expect(
      service.assign('booking-1', dto, dispatcherUser, 'req-1'),
    ).rejects.toMatchObject({ code: 'CONFLICT', status: HttpStatus.CONFLICT });
    expect((stub['ambulance'] as { updateMany: jest.Mock }).updateMany).not.toHaveBeenCalled();
  });

  it('throws CONFLICT when the ambulance driver is not VERIFIED', async () => {
    const { stub, prisma } = createPrismaStub();
    (stub['booking'] as { findUnique: jest.Mock }).findUnique.mockResolvedValue(
      bookingRow('REQUESTED'),
    );
    (stub['ambulance'] as { findUnique: jest.Mock }).findUnique.mockResolvedValue(
      ambulanceRow({ availability: 'AVAILABLE', identityVerification: 'UNVERIFIED' }),
    );
    (stub['ambulance'] as { updateMany: jest.Mock }).updateMany.mockResolvedValue({ count: 1 });
    (stub['$transaction'] as jest.Mock).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(stub),
    );
    const service = new DispatchService(prisma, notificationsMock, auditMock);

    await expect(
      service.assign('booking-1', dto, dispatcherUser, 'req-1'),
    ).rejects.toMatchObject({ code: 'CONFLICT', status: HttpStatus.CONFLICT });
    expect((stub['trip'] as { create: jest.Mock }).create).not.toHaveBeenCalled();
  });
});

import { HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { JwtService } from '@nestjs/jwt';

function createPrismaStub(): { stub: Record<string, unknown>; prisma: PrismaService } {
  const stub: Record<string, unknown> = {
    user: { findUnique: jest.fn(), create: jest.fn() },
    driverProfile: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  return { stub, prisma: stub as unknown as PrismaService };
}

const jwtMock = { signAsync: jest.fn().mockResolvedValue('signed-token') } as unknown as JwtService;

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('throws a generic 401 for a wrong password without leaking account details', async () => {
      const { stub, prisma } = createPrismaStub();
      const passwordHash = await bcrypt.hash('Correct#Password1', 10);
      (stub['user'] as { findUnique: jest.Mock }).findUnique.mockResolvedValue({
        id: 'u1',
        publicId: 'patient-a',
        email: 'patient@example.com',
        role: 'PATIENT',
        status: 'ACTIVE',
        deletedAt: null,
        passwordHash,
      });
      const service = new AuthService(prisma, jwtMock);

      await expect(
        service.login({ email: 'patient@example.com', password: 'Wrong#Password1' }, '1.2.3.4'),
      ).rejects.toMatchObject({ status: HttpStatus.UNAUTHORIZED });

      // The message must be the generic one, not a user-specific hint.
      try {
        await service.login({ email: 'patient@example.com', password: 'Wrong#Password1' }, '1.2.3.4');
        fail('expected login to fail');
      } catch (error) {
        expect((error as Error).message).toBe('Invalid email or password');
      }
    });

    it('throws the same generic 401 for an unknown email', async () => {
      const { stub, prisma } = createPrismaStub();
      (stub['user'] as { findUnique: jest.Mock }).findUnique.mockResolvedValue(null);
      const service = new AuthService(prisma, jwtMock);

      await expect(
        service.login({ email: 'ghost@example.com', password: 'Whatever#123' }, '1.2.3.4'),
      ).rejects.toMatchObject({ status: HttpStatus.UNAUTHORIZED });
    });

    it('throws 429 RATE_LIMITED after 10 failed attempts for the same email+IP', async () => {
      const { stub, prisma } = createPrismaStub();
      (stub['user'] as { findUnique: jest.Mock }).findUnique.mockResolvedValue(null);
      const service = new AuthService(prisma, jwtMock);

      const attempt = (): Promise<unknown> =>
        service.login({ email: 'ratelimit@example.com', password: 'Whatever#123' }, '1.2.3.4');

      for (let i = 0; i < 10; i += 1) {
        await expect(attempt()).rejects.toMatchObject({ status: HttpStatus.UNAUTHORIZED });
      }
      await expect(attempt()).rejects.toMatchObject({
        code: 'RATE_LIMITED',
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });
  });

  describe('register', () => {
    it('creates a DriverProfile when role is DRIVER', async () => {
      const { stub, prisma } = createPrismaStub();
      const createdUser = {
        id: 'u1',
        publicId: 'driver-1',
        name: 'Sample Driver',
        email: 'driver@example.com',
        phone: '+15550000002',
        role: 'DRIVER',
        status: 'ACTIVE',
        createdAt: new Date('2024-01-01T00:00:00Z'),
      };
      (stub['user'] as { findUnique: jest.Mock }).findUnique.mockResolvedValue(null);
      (stub['$transaction'] as jest.Mock).mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => fn(stub),
      );
      (stub['user'] as { create: jest.Mock }).create.mockResolvedValue(createdUser);
      const service = new AuthService(prisma, jwtMock);

      const result = await service.register(
        {
          name: 'Sample Driver',
          email: 'driver@example.com',
          phone: '+15550000002',
          password: 'Driver#2024',
          role: 'DRIVER',
        },
      );

      expect(result.accessToken).toBe('signed-token');
      expect(result.user.role).toBe('DRIVER');
      const driverProfileCreate = (stub['driverProfile'] as { create: jest.Mock }).create;
      expect(driverProfileCreate).toHaveBeenCalledTimes(1);
      expect(driverProfileCreate.mock.calls[0]?.[0]).toMatchObject({
        data: {
          userId: 'u1',
          availability: 'OFF_DUTY',
          licenseVerification: 'UNVERIFIED',
          identityVerification: 'UNVERIFIED',
        },
      });
    });

    it('returns 409 CONFLICT on duplicate email with a generic message', async () => {
      const { stub, prisma } = createPrismaStub();
      (stub['user'] as { findUnique: jest.Mock }).findUnique.mockResolvedValue({ id: 'u1' });
      const service = new AuthService(prisma, jwtMock);

      await expect(
        service.register({
          name: 'Sample Patient',
          email: 'patient@example.com',
          phone: '+15550000001',
          password: 'Patient#2024',
          role: 'PATIENT',
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT', status: HttpStatus.CONFLICT });
    });
  });
});

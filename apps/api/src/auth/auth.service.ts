import { HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import type { RegisterDto, LoginDto, UserView } from '@abs/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { mapUser, type UserRow } from '../common/mappers';
import { ApiException } from '../common/errors/api-exception';

const BCRYPT_ROUNDS = 10;
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 5 * 60 * 1000;

interface RateEntry {
  count: number;
  resetAt: number;
}

export interface AuthResult {
  user: UserView;
  accessToken: string;
}

@Injectable()
export class AuthService {
  /** In-memory rate limiting: max 10 login attempts per email+IP per 5 minutes. */
  private readonly loginAttempts = new Map<string, RateEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) {
      // Generic message: do not confirm whether the account exists.
      throw new ApiException(
        'CONFLICT',
        HttpStatus.CONFLICT,
        'Unable to create an account with the provided details',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const publicId = randomUUID();

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          publicId,
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          passwordHash,
          role: dto.role,
          status: 'ACTIVE',
        },
      });
      if (dto.role === 'DRIVER') {
        await tx.driverProfile.create({
          data: {
            userId: created.id,
            availability: 'OFF_DUTY',
            licenseVerification: 'UNVERIFIED',
            identityVerification: 'UNVERIFIED',
          },
        });
      }
      return created;
    });

    return {
      user: mapUser(user as UserRow),
      accessToken: await this.signToken(user),
    };
  }

  async login(dto: LoginDto, ip: string): Promise<AuthResult> {
    const rateKey = `${dto.email}:${ip}`;
    const now = Date.now();
    const entry = this.loginAttempts.get(rateKey);
    if (entry && now < entry.resetAt && entry.count >= LOGIN_MAX_ATTEMPTS) {
      throw new ApiException(
        'RATE_LIMITED',
        HttpStatus.TOO_MANY_REQUESTS,
        'Too many login attempts. Try again later.',
      );
    }
    if (!entry || now >= entry.resetAt) {
      this.loginAttempts.set(rateKey, {
        count: 1,
        resetAt: now + LOGIN_WINDOW_MS,
      });
    } else {
      entry.count += 1;
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    // Same error for unknown email and wrong password (no account enumeration).
    const invalidCredentials = new UnauthorizedException(
      'Invalid email or password',
    );
    if (!user) {
      throw invalidCredentials;
    }
    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw invalidCredentials;
    }
    if (user.status !== 'ACTIVE' || user.deletedAt !== null) {
      throw invalidCredentials;
    }

    this.loginAttempts.delete(rateKey);
    return {
      user: mapUser(user),
      accessToken: await this.signToken(user),
    };
  }

  async me(userPublicId: string): Promise<UserView> {
    const user = await this.prisma.user.findUnique({
      where: { publicId: userPublicId },
    });
    if (!user) {
      throw new ApiException(
        'UNAUTHENTICATED',
        HttpStatus.UNAUTHORIZED,
        'User no longer exists',
      );
    }
    return mapUser(user);
  }

  private async signToken(user: { publicId: string; role: string }): Promise<string> {
    return this.jwtService.signAsync({ sub: user.publicId, role: user.role });
  }
}

import { HttpStatus, Injectable } from '@nestjs/common';
import type { DriverAvailabilityDto, DriverProfileView, DriverVerificationDto } from '@abs/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ApiException } from '../common/errors/api-exception';
import { mapDriverProfile } from '../common/mappers';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getMe(userPublicId: string): Promise<DriverProfileView> {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId: await this.requireUserId(userPublicId) },
      include: { user: { select: { publicId: true } } },
    });
    if (!profile) {
      throw new ApiException('NOT_FOUND', HttpStatus.NOT_FOUND, 'Driver profile not found');
    }
    return mapDriverProfile(profile);
  }

  async updateAvailability(userPublicId: string, dto: DriverAvailabilityDto): Promise<DriverProfileView> {
    const userId = await this.requireUserId(userPublicId);
    const existing = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (!existing) {
      throw new ApiException('NOT_FOUND', HttpStatus.NOT_FOUND, 'Driver profile not found');
    }
    const updated = await this.prisma.driverProfile.update({
      where: { userId },
      data: { availability: dto.status },
      include: { user: { select: { publicId: true } } },
    });
    return mapDriverProfile(updated);
  }

  async list(): Promise<Array<DriverProfileView & { publicId: string; name: string; role: string }>> {
    const profiles = await this.prisma.driverProfile.findMany({
      include: { user: { select: { publicId: true, name: true, role: true } } },
      orderBy: { id: 'asc' },
    });
    return profiles.map((profile) => ({
      ...mapDriverProfile(profile),
      publicId: profile.user.publicId,
      name: profile.user.name,
      role: profile.user.role,
    }));
  }

  /**
   * Records identity and licence checks for a crew member. Only a verified
   * driver may be dispatched (docs/RULES.md "Driver and Fleet Rules").
   */
  async setVerification(
    driverPublicId: string,
    dto: DriverVerificationDto,
    actorPublicId: string,
    requestId: string,
  ): Promise<DriverProfileView> {
    const user = await this.prisma.user.findUnique({
      where: { publicId: driverPublicId },
      select: { id: true, role: true },
    });
    if (!user || user.role !== 'DRIVER') {
      throw new ApiException('NOT_FOUND', HttpStatus.NOT_FOUND, 'Driver not found');
    }
    const profile = await this.prisma.driverProfile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      throw new ApiException('NOT_FOUND', HttpStatus.NOT_FOUND, 'Driver profile not found');
    }

    const identityVerification = dto.identityVerification ?? profile.identityVerification;
    const licenseVerification = dto.licenseVerification ?? profile.licenseVerification;

    const updated = await this.prisma.driverProfile.update({
      where: { userId: user.id },
      data: {
        identityVerification,
        licenseVerification,
        verifiedAt: identityVerification === 'VERIFIED' ? (profile.verifiedAt ?? new Date()) : null,
      },
      include: { user: { select: { publicId: true } } },
    });

    this.audit.record({
      actorPublicId,
      action: 'DRIVER_VERIFICATION_UPDATED',
      resourceType: 'DriverProfile',
      resourcePublicId: driverPublicId,
      requestId,
      result: 'SUCCESS',
    });

    return mapDriverProfile(updated);
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

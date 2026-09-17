import { HttpStatus, Injectable } from '@nestjs/common';
import type { DriverAvailabilityDto, DriverProfileView } from '@abs/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ApiException } from '../common/errors/api-exception';
import { mapDriverProfile } from '../common/mappers';

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

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

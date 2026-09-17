import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AMBULANCE_STATUSES, type AmbulanceCreateDto, type AmbulanceView } from '@abs/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ApiException } from '../common/errors/api-exception';
import { mapAmbulance, type AmbulanceRow } from '../common/mappers';

const TRIP_LOCKED_STATUSES = new Set(['ON_TRIP']);

@Injectable()
export class AmbulancesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: AmbulanceCreateDto): Promise<AmbulanceView> {
    const created = await this.prisma.ambulance.create({
      data: {
        publicId: randomUUID(),
        registrationNumber: dto.registrationNumber,
        type: dto.type,
        capabilities: JSON.stringify(dto.capabilities),
        serviceArea: dto.serviceArea,
        status: 'AVAILABLE',
        baseLatitude: dto.baseLatitude ?? null,
        baseLongitude: dto.baseLongitude ?? null,
      },
    });
    return mapAmbulance(created);
  }

  async list(filters: { status?: string; type?: string; serviceArea?: string }): Promise<AmbulanceView[]> {
    const where: { status?: string; type?: string; serviceArea?: { contains: string } } = {};
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.serviceArea) where.serviceArea = { contains: filters.serviceArea };
    const rows = await this.prisma.ambulance.findMany({ where, orderBy: { createdAt: 'desc' } });
    return rows.map((row) => mapAmbulance(row));
  }

  async updateStatus(publicId: string, status: string): Promise<AmbulanceView> {
    if (!(AMBULANCE_STATUSES as readonly string[]).includes(status)) {
      throw new ApiException(
        'VALIDATION_ERROR',
        HttpStatus.BAD_REQUEST,
        'Validation failed',
        { fieldErrors: { status: [`Invalid ambulance status: ${status}`] } },
      );
    }
    const ambulance = await this.prisma.ambulance.findUnique({ where: { publicId } });
    if (!ambulance) {
      throw new ApiException('NOT_FOUND', HttpStatus.NOT_FOUND, 'Ambulance not found');
    }
    if (TRIP_LOCKED_STATUSES.has(ambulance.status) && status !== 'ON_TRIP') {
      throw new ApiException(
        'CONFLICT',
        HttpStatus.CONFLICT,
        'Ambulance is on an active trip and its status cannot be changed',
      );
    }
    const updated = await this.prisma.ambulance.update({
      where: { publicId },
      data: { status },
    });
    return mapAmbulance(updated);
  }
}

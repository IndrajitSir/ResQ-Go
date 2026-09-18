import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AMBULANCE_STATUSES,
  type AmbulanceCreateDto,
  type AmbulanceView,
  type AssignAmbulanceDriverDto,
} from '@abs/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ApiException } from '../common/errors/api-exception';
import { mapAmbulance } from '../common/mappers';
import { AuditService } from '../audit/audit.service';

const TRIP_LOCKED_STATUSES = new Set(['ON_TRIP']);

/** Driver fields every ambulance response needs. */
const DRIVER_SELECT = { select: { publicId: true, name: true } } as const;

@Injectable()
export class AmbulancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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
    const rows = await this.prisma.ambulance.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { driver: DRIVER_SELECT },
    });
    return rows.map((row) => mapAmbulance(row));
  }

  /**
   * Attaches a crew member to a vehicle (or releases it with `null`).
   *
   * A driver can only be attached to one vehicle at a time: attaching them here
   * detaches them from any other vehicle so a crew can never be dispatched twice.
   */
  async assignDriver(
    publicId: string,
    dto: AssignAmbulanceDriverDto,
    actorPublicId: string,
    requestId: string,
  ): Promise<AmbulanceView> {
    const ambulance = await this.prisma.ambulance.findUnique({ where: { publicId } });
    if (!ambulance) {
      throw new ApiException('NOT_FOUND', HttpStatus.NOT_FOUND, 'Ambulance not found');
    }
    if (TRIP_LOCKED_STATUSES.has(ambulance.status)) {
      throw new ApiException(
        'CONFLICT',
        HttpStatus.CONFLICT,
        'The crew cannot be changed while the vehicle is on an active trip',
      );
    }

    let driver: { id: string } | null = null;
    if (dto.driverPublicId !== null) {
      const candidate = await this.prisma.user.findUnique({
        where: { publicId: dto.driverPublicId },
        select: { id: true, role: true, status: true, driverProfile: { select: { id: true } } },
      });
      if (!candidate || candidate.role !== 'DRIVER') {
        throw new ApiException(
          'NOT_FOUND',
          HttpStatus.NOT_FOUND,
          'Driver not found',
        );
      }
      if (candidate.status !== 'ACTIVE') {
        throw new ApiException(
          'CONFLICT',
          HttpStatus.CONFLICT,
          'This driver account is not active',
        );
      }
      if (!candidate.driverProfile) {
        throw new ApiException(
          'CONFLICT',
          HttpStatus.CONFLICT,
          'This driver has no driver profile and cannot be dispatched',
        );
      }
      driver = { id: candidate.id };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (driver) {
        await tx.ambulance.updateMany({
          where: { driverId: driver.id, NOT: { id: ambulance.id } },
          data: { driverId: null },
        });
      }
      return tx.ambulance.update({
        where: { id: ambulance.id },
        data: { driverId: driver?.id ?? null },
        include: { driver: DRIVER_SELECT },
      });
    });

    this.audit.record({
      actorPublicId,
      action: driver ? 'AMBULANCE_CREW_ASSIGNED' : 'AMBULANCE_CREW_RELEASED',
      resourceType: 'Ambulance',
      resourcePublicId: publicId,
      requestId,
      result: 'SUCCESS',
    });

    return mapAmbulance(updated);
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
      include: { driver: DRIVER_SELECT },
    });
    return mapAmbulance(updated);
  }
}

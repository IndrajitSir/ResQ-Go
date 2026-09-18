import { Body, Controller, Get, Patch, Param, Post, Query, Request } from '@nestjs/common';
import { z } from 'zod';
import type { Request as ExpressRequest } from 'express';
import {
  AMBULANCE_STATUSES,
  ambulanceSchema,
  assignAmbulanceDriverSchema,
  type AmbulanceCreateDto,
  type AssignAmbulanceDriverDto,
} from '@abs/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OPERATOR_ROLES } from '../common/auth/role-sets';
import type { AuthUser } from '../common/auth/auth-user';
import { AmbulancesService } from './ambulances.service';

const ambulanceStatusSchema = z.object({ status: z.enum(AMBULANCE_STATUSES) });

@Controller('ambulances')
@Roles(...OPERATOR_ROLES)
export class AmbulancesController {
  constructor(private readonly ambulancesService: AmbulancesService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(ambulanceSchema)) dto: AmbulanceCreateDto,
  ): Promise<Awaited<ReturnType<AmbulancesService['create']>>> {
    return this.ambulancesService.create(dto);
  }

  @Get()
  list(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('serviceArea') serviceArea?: string,
  ): Promise<Awaited<ReturnType<AmbulancesService['list']>>> {
    return this.ambulancesService.list({ status, type, serviceArea });
  }

  /** Attaches or releases the crew for a vehicle (dispatch must never guess). */
  @Patch(':publicId/driver')
  assignDriver(
    @Param('publicId') publicId: string,
    @Body(new ZodValidationPipe(assignAmbulanceDriverSchema)) dto: AssignAmbulanceDriverDto,
    @CurrentUser() user: AuthUser,
    @Request() request: ExpressRequest,
  ): Promise<Awaited<ReturnType<AmbulancesService['assignDriver']>>> {
    return this.ambulancesService.assignDriver(publicId, dto, user!.publicId, request.requestId ?? '');
  }

  @Patch(':publicId/status')
  updateStatus(
    @Param('publicId') publicId: string,
    @Body(new ZodValidationPipe(ambulanceStatusSchema)) body: { status: string },
  ): Promise<Awaited<ReturnType<AmbulancesService['updateStatus']>>> {
    return this.ambulancesService.updateStatus(publicId, body.status);
  }
}

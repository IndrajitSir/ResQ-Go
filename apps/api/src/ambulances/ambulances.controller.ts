import { Body, Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  AMBULANCE_STATUSES,
  ambulanceSchema,
  type AmbulanceCreateDto,
} from '@abs/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Roles } from '../common/decorators/roles.decorator';
import { OPERATOR_ROLES } from '../common/auth/role-sets';
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

  @Patch(':publicId/status')
  updateStatus(
    @Param('publicId') publicId: string,
    @Body(new ZodValidationPipe(ambulanceStatusSchema)) body: { status: string },
  ): Promise<Awaited<ReturnType<AmbulancesService['updateStatus']>>> {
    return this.ambulancesService.updateStatus(publicId, body.status);
  }
}

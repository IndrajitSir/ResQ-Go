import { Body, Controller, Get, Param, Patch, Request } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import {
  driverAvailabilitySchema,
  driverVerificationSchema,
  type DriverAvailabilityDto,
  type DriverVerificationDto,
} from '@abs/contracts';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { DRIVER_ONLY, OPERATOR_ROLES } from '../common/auth/role-sets';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../common/auth/auth-user';
import { DriversService } from './drivers.service';

@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get('me')
  @Roles(...DRIVER_ONLY)
  me(@CurrentUser() user: AuthUser): Promise<Awaited<ReturnType<DriversService['getMe']>>> {
    return this.driversService.getMe(user!.publicId);
  }

  @Patch('me/availability')
  @Roles(...DRIVER_ONLY)
  updateAvailability(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(driverAvailabilitySchema)) dto: DriverAvailabilityDto,
  ): Promise<Awaited<ReturnType<DriversService['updateAvailability']>>> {
    return this.driversService.updateAvailability(user!.publicId, dto);
  }

  @Get()
  @Roles(...OPERATOR_ROLES)
  list(): Promise<Awaited<ReturnType<DriversService['list']>>> {
    return this.driversService.list();
  }

  /** Operators record identity and licence checks for a crew member. */
  @Patch(':publicId/verification')
  @Roles(...OPERATOR_ROLES)
  setVerification(
    @Param('publicId') publicId: string,
    @Body(new ZodValidationPipe(driverVerificationSchema)) dto: DriverVerificationDto,
    @CurrentUser() user: AuthUser,
    @Request() request: ExpressRequest,
  ): Promise<Awaited<ReturnType<DriversService['setVerification']>>> {
    return this.driversService.setVerification(publicId, dto, user!.publicId, request.requestId ?? '');
  }
}

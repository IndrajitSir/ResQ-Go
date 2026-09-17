import { Body, Controller, Get, Patch } from '@nestjs/common';
import { driverAvailabilitySchema, type DriverAvailabilityDto } from '@abs/contracts';
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
}

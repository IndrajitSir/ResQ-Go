import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  assignmentDecisionSchema,
  tripLocationSchema,
  tripStatusUpdateSchema,
  type AssignmentDecisionDto,
  type TripLocationDto,
  type TripStatusUpdateDto,
} from '@abs/contracts';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { DRIVER_ONLY } from '../common/auth/role-sets';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../common/auth/auth-user';
import { TripsService } from './trips.service';

@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get('mine')
  @Roles(...DRIVER_ONLY)
  mine(@CurrentUser() user: AuthUser): Promise<Awaited<ReturnType<TripsService['mine']>>> {
    return this.tripsService.mine(user!.publicId);
  }

  @Post(':publicId/decision')
  @Roles(...DRIVER_ONLY)
  decide(
    @Param('publicId') publicId: string,
    @Body(new ZodValidationPipe(assignmentDecisionSchema)) dto: AssignmentDecisionDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Awaited<ReturnType<TripsService['decide']>>> {
    return this.tripsService.decide(publicId, dto, user!);
  }

  @Post(':publicId/status')
  @Roles(...DRIVER_ONLY)
  updateStatus(
    @Param('publicId') publicId: string,
    @Body(new ZodValidationPipe(tripStatusUpdateSchema)) dto: TripStatusUpdateDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Awaited<ReturnType<TripsService['updateStatus']>>> {
    return this.tripsService.updateStatus(publicId, dto, user!);
  }

  /** Driver position ping; the requester and dispatch see it live. */
  @Post(':publicId/location')
  @Roles(...DRIVER_ONLY)
  recordLocation(
    @Param('publicId') publicId: string,
    @Body(new ZodValidationPipe(tripLocationSchema)) dto: TripLocationDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Awaited<ReturnType<TripsService['recordLocation']>>> {
    return this.tripsService.recordLocation(publicId, dto, user!);
  }

  @Get(':publicId')
  findOne(
    @Param('publicId') publicId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<Awaited<ReturnType<TripsService['findOne']>>> {
    return this.tripsService.findOne(publicId, user!);
  }
}

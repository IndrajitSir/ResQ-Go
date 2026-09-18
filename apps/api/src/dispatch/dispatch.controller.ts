import { Controller, Get, Param, Post, Body, Query, Request } from '@nestjs/common';
import { assignAmbulanceSchema, type AssignAmbulanceDto } from '@abs/contracts';
import type { Request as ExpressRequest } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OPERATOR_ROLES } from '../common/auth/role-sets';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../common/auth/auth-user';
import { DispatchService } from './dispatch.service';

@Controller('dispatch')
@Roles(...OPERATOR_ROLES)
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Get('queue')
  queue(): Promise<Awaited<ReturnType<DispatchService['queue']>>> {
    return this.dispatchService.queue();
  }

  @Get('dashboard')
  dashboard(): Promise<Awaited<ReturnType<DispatchService['dashboard']>>> {
    return this.dispatchService.dashboard();
  }

  @Get('eligible')
  eligible(
    @Query('bookingPublicId') bookingPublicId: string,
  ): Promise<Awaited<ReturnType<DispatchService['eligible']>>> {
    return this.dispatchService.eligible(bookingPublicId);
  }

  @Post('bookings/:publicId/assign')
  assign(
    @Param('publicId') publicId: string,
    @Body(new ZodValidationPipe(assignAmbulanceSchema)) dto: AssignAmbulanceDto,
    @CurrentUser() user: AuthUser,
    @Request() request: ExpressRequest,
  ): Promise<Awaited<ReturnType<DispatchService['assign']>>> {
    return this.dispatchService.assign(publicId, dto, user!, request.requestId ?? '');
  }
}

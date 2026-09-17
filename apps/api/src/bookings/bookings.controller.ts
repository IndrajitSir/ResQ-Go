import { Body, Controller, Get, Param, Post, Query, Request } from '@nestjs/common';
import {
  cancelBookingSchema,
  createBookingSchema,
  listBookingsQuerySchema,
  type CancelBookingDto,
  type CreateBookingDto,
  type ListBookingsQuery,
} from '@abs/contracts';
import type { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PATIENT_ONLY } from '../common/auth/role-sets';
import type { AuthUser } from '../common/auth/auth-user';
import { BookingsService } from './bookings.service';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Roles(...PATIENT_ONLY)
  create(
    @Body(new ZodValidationPipe(createBookingSchema)) dto: CreateBookingDto,
    @CurrentUser() user: AuthUser,
    @Request() request: Request,
  ): Promise<Awaited<ReturnType<BookingsService['create']>>> {
    return this.bookingsService.create(dto, user!, request.requestId ?? '');
  }

  @Get()
  async list(
    @Query(new ZodValidationPipe(listBookingsQuerySchema)) query: ListBookingsQuery,
    @CurrentUser() user: AuthUser,
  ): Promise<Awaited<ReturnType<BookingsService['list']>>> {
    return this.bookingsService.list(query, user!);
  }

  @Get(':publicId')
  findOne(
    @Param('publicId') publicId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<Awaited<ReturnType<BookingsService['findOne']>>> {
    return this.bookingsService.findOne(publicId, user!);
  }

  @Post(':publicId/cancel')
  async cancel(
    @Param('publicId') publicId: string,
    @Body(new ZodValidationPipe(cancelBookingSchema)) dto: CancelBookingDto,
    @CurrentUser() user: AuthUser,
    @Request() request: Request,
  ): Promise<Awaited<ReturnType<BookingsService['cancel']>>> {
    return this.bookingsService.cancel(publicId, dto, user!, request.requestId ?? '');
  }

  @Get(':publicId/events')
  listEvents(
    @Param('publicId') publicId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<Awaited<ReturnType<BookingsService['listEvents']>>> {
    return this.bookingsService.listEvents(publicId, user!);
  }
}

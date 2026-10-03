import { Controller, Get, Request } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import type { UserView } from '@abs/contracts';
import { AuthService } from '../auth/auth.service';

/**
 * Current-user lookup.
 *
 * Delegates to AuthService.me so a deleted or deactivated account produces the
 * same 401 as everywhere else, instead of Prisma's not-found exception
 * bubbling up as an opaque 500.
 */
@Controller('users')
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  me(@Request() request: ExpressRequest): Promise<UserView> {
    return this.authService.me(request.user!.publicId);
  }
}
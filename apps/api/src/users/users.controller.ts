import { Controller, Get, Request } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { mapUser } from '../common/mappers';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  async me(@Request() request: ExpressRequest) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { publicId: request.user!.publicId },
    });
    return mapUser(user);
  }
}

import { Controller, Get, Request } from '@nestjs/common';
import type { Request } from 'express';
import { mapNotification } from '../common/mappers';
import { PrismaService } from '../prisma/prisma.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('mine')
  async mine(@Request() request: Request) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { publicId: request.user!.publicId },
      select: { id: true },
    });
    const rows = await this.prisma.notification.findMany({
      where: { recipientId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((row) => mapNotification(row));
  }
}

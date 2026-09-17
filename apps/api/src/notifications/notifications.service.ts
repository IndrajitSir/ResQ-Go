import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Creates IN_APP / PENDING notification records. Delivery is handled later by a worker. */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    recipientId: string,
    templateKey: string,
    body: string,
  ): Promise<void> {
    await this.prisma.notification.create({
      data: {
        publicId: crypto.randomUUID(),
        recipientId,
        channel: 'IN_APP',
        templateKey,
        body,
        deliveryStatus: 'PENDING',
      },
    });
  }
}

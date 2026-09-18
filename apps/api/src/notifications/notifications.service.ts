import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

/**
 * Creates notification records and pushes them to connected clients.
 *
 * In-app notifications are considered sent as soon as the record is written;
 * external channels (SMS/email) will be handed to a worker with retries and a
 * dead-letter path (see docs/DESIGN.md "Reliability") without changing callers.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async create(
    recipientId: string,
    templateKey: string,
    body: string,
  ): Promise<void> {
    const row = await this.prisma.notification.create({
      data: {
        publicId: randomUUID(),
        recipientId,
        channel: 'IN_APP',
        templateKey,
        body,
        deliveryStatus: 'SENT',
      },
      include: { recipient: { select: { publicId: true } } },
    });

    this.realtime.publish(
      { userPublicIds: [row.recipient.publicId] },
      { type: 'notification.created', message: body },
    );
  }
}

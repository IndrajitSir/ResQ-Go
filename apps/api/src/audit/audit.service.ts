import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actorPublicId?: string;
  action: string;
  resourceType: string;
  resourcePublicId?: string;
  requestId?: string;
  result: 'SUCCESS' | 'FAILURE';
}

/** Fire-and-forget audit logging; failures never break the request path. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  record(entry: AuditEntry): void {
    this.prisma.auditLog
      .create({
        data: {
          publicId: crypto.randomUUID(),
          actorPublicId: entry.actorPublicId ?? null,
          action: entry.action,
          resourceType: entry.resourceType,
          resourcePublicId: entry.resourcePublicId ?? null,
          requestId: entry.requestId ?? null,
          result: entry.result,
        },
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to write audit log for action=${entry.action}: ${String(error)}`,
        );
      });
  }

  async list(): Promise<
    Array<{
      publicId: string;
      actorPublicId: string | null;
      action: string;
      resourceType: string;
      resourcePublicId: string | null;
      requestId: string | null;
      result: string;
      createdAt: string;
    }>
  > {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => ({
      publicId: row.publicId,
      actorPublicId: row.actorPublicId,
      action: row.action,
      resourceType: row.resourceType,
      resourcePublicId: row.resourcePublicId,
      requestId: row.requestId,
      result: row.result,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}

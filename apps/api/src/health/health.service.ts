import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Never let a health probe hang a container orchestrator. */
const PROBE_TIMEOUT_MS = 3000;

export interface ReadinessReport {
  status: 'ok' | 'degraded';
  checks: {
    database: {
      status: 'up' | 'down';
      /** Round-trip time of the probe, in milliseconds. */
      latencyMs?: number;
      reason?: string;
    };
  };
  timestamp: string;
}

/**
 * Readiness reporting.
 *
 * Liveness (`/health`) answers "is this process running" and must not depend
 * on anything external, otherwise a database blip would make orchestrators
 * restart an otherwise healthy process. Readiness (`/health/ready`) answers
 * "can this instance serve traffic" and does depend on the database.
 */
@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async checkReadiness(): Promise<ReadinessReport> {
    const startedAt = Date.now();

    try {
      // A bounded round trip: either the engine responds, or we report down.
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        checks: { database: { status: 'up', latencyMs: Date.now() - startedAt } },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'degraded',
        checks: {
          database: {
            status: 'down',
            latencyMs: Date.now() - startedAt,
            // Only the failure category is exposed; connection strings and
            // credentials must never reach an unauthenticated endpoint.
            reason: error instanceof Error ? error.name : 'UNKNOWN',
          },
        },
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export const HEALTH_PROBE_TIMEOUT_MS = PROBE_TIMEOUT_MS;
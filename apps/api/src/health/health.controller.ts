import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { HealthService, type ReadinessReport } from './health.service';

/**
 * Health endpoints used by Render, Docker, and uptime monitors.
 *
 * Both are public (unauthenticated) because an orchestrator has no session,
 * and neither reveals anything about the deployment beyond up/down.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * Liveness: the process is up and the HTTP stack is serving.
   *
   * Intentionally free of external dependencies so a database outage does not
   * cause a restart loop.
   */
  @Get()
  @Public()
  check(): { status: 'ok'; uptimeSeconds: number } {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }

  /**
   * Readiness: this instance can serve requests.
   *
   * Answers 503 when a dependency is unreachable so a load balancer stops
   * sending traffic here, while `/health` keeps reporting the process as live.
   */
  @Get('ready')
  @Public()
  @HttpCode(HttpStatus.OK)
  async ready(@Res({ passthrough: true }) res: Response): Promise<ReadinessReport> {
    const report = await this.health.checkReadiness();
    res.status(report.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return report;
  }
}
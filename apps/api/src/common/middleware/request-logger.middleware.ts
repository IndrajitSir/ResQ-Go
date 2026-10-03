import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/** Paths that are too noisy or too low-value to log individually. */
const QUIET_PATHS = new Set(['/health', '/health/ready']);

/** Paths carrying identifiers in the URL, e.g. booking and trip ids. */
const IDENTIFIER_PATH = /\/(bookings|trips|ambulances|drivers|users)\/[A-Za-z0-9-]+/g;

/**
 * Replaces opaque resource identifiers with a stable placeholder so operational
 * logs stay useful for debugging without becoming a record of who requested
 * which booking. Exported for direct testing.
 */
export function scrubPath(url: string): string {
  const [pathname = '/'] = url.split('?');
  return pathname.replace(IDENTIFIER_PATH, '/$1/:id');
}

/**
 * Structured access logging.
 *
 * Emits one JSON line per completed request, correlated by requestId. It
 * deliberately records no request bodies, query strings, headers, tokens, or
 * coordinates (docs/RULES.md "Data Rules").
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();
    const path = scrubPath(req.originalUrl ?? req.url);

    res.on('finish', () => {
      if (QUIET_PATHS.has(path)) return;

      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const line = {
        level: res.statusCode >= 500 ? 'error' : 'info',
        message: 'request',
        requestId: req.requestId,
        method: req.method,
        path,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        timestamp: new Date().toISOString(),
      };
      // Single-line JSON so log shippers can parse it without a regex.
      process.stdout.write(`${JSON.stringify(line)}\n`);
    });

    next();
  }
}
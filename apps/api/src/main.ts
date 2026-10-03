import './env';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { API_V1_PREFIX } from '@abs/config';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';
import { loadRuntimeConfig } from './common/config/env';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  // Validate configuration before anything binds a port: a misconfigured
  // deployment should fail loudly and immediately, not on first request.
  const config = loadRuntimeConfig();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: config.isProduction ? ['log', 'error', 'warn'] : ['log', 'error', 'warn', 'debug'],
  });

  app.setGlobalPrefix(API_V1_PREFIX);

  // An explicit allowlist: never reflect the request Origin back to the
  // caller, and never allow a wildcard alongside credentials.
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
    maxAge: 600,
  });

  // Order matters: assign the correlation id first so every later log line,
  // including errors, can reference it.
  const requestIdMiddleware = new RequestIdMiddleware();
  const securityHeadersMiddleware = new SecurityHeadersMiddleware();
  const requestLoggerMiddleware = new RequestLoggerMiddleware();
  app.use(requestIdMiddleware.use.bind(requestIdMiddleware));
  app.use(securityHeadersMiddleware.use.bind(securityHeadersMiddleware));
  app.use(requestLoggerMiddleware.use.bind(requestLoggerMiddleware));

  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  // Terminate in-flight work on SIGTERM so a rolling deploy never drops a
  // dispatch assignment half way through.
  app.enableShutdownHooks();

  await app.listen(config.port);

  logger.log(
    `ResQ-Go API listening on port ${config.port} (${config.nodeEnv}) ` +
      `with ${config.corsOrigins.length} allowed origin(s)`,
  );
}

void bootstrap().catch((error: unknown) => {
  // Configuration errors are the most common startup failure; surface them in
  // full rather than as an opaque stack trace.
  process.stderr.write(
    `${JSON.stringify({
      level: 'error',
      message: 'Failed to start ResQ-Go API',
      reason: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })}\n`,
  );
  process.exitCode = 1;
});
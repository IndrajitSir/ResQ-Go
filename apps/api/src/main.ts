import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { intFromEnv, API_PORT_DEFAULT, API_V1_PREFIX, requireEnv } from '@abs/config';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

async function bootstrap(): Promise<void> {
  // Fail fast if the JWT secret is not configured.
  requireEnv('JWT_SECRET', process.env.JWT_SECRET);

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix(API_V1_PREFIX);
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  const requestIdMiddleware = new RequestIdMiddleware();
  app.use(requestIdMiddleware.use.bind(requestIdMiddleware));
  app.useGlobalFilters(new GlobalHttpExceptionFilter());
  app.enableShutdownHooks();

  const port = intFromEnv(process.env.PORT, API_PORT_DEFAULT);
  await app.listen(port);
}

void bootstrap();

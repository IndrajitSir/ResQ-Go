import { loadRuntimeConfig } from '../common/config/env';
import { scrubPath } from '../common/middleware/request-logger.middleware';
import { SecurityHeadersMiddleware } from '../common/middleware/security-headers.middleware';
import { HealthService } from '../health/health.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { Request } from 'express';

const emptyRequest = {} as unknown as Request;

describe('runtime configuration', () => {
  const baseEnv = { JWT_SECRET: 'a'.repeat(48) };

  it('parses a comma-separated origin list and strips trailing slashes', () => {
    const config = loadRuntimeConfig({
      ...baseEnv,
      CORS_ORIGIN: 'https://resq-go.vercel.app/ , https://ops.example.com',
    });

    expect(config.corsOrigins).toEqual(['https://resq-go.vercel.app', 'https://ops.example.com']);
  });

  it('falls back to the local dev origin when none is configured', () => {
    expect(loadRuntimeConfig({ ...baseEnv }).corsOrigins).toEqual(['http://localhost:3000']);
  });

  it('rejects a wildcard origin, which is unsafe alongside credentials', () => {
    expect(() => loadRuntimeConfig({ ...baseEnv, CORS_ORIGIN: '*' })).toThrow(/CORS_ORIGIN/);
  });

  it('rejects origins that are not absolute http(s) URLs', () => {
    expect(() => loadRuntimeConfig({ ...baseEnv, CORS_ORIGIN: 'resq-go.vercel.app' })).toThrow(
      /CORS_ORIGIN/,
    );
  });

  it('requires a JWT secret in every environment', () => {
    expect(() => loadRuntimeConfig({})).toThrow(/JWT_SECRET/);
  });

  it('refuses a known placeholder secret in production', () => {
    expect(() =>
      loadRuntimeConfig({ JWT_SECRET: 'change-me-in-local-dev-only', NODE_ENV: 'production' }),
    ).toThrow(/JWT_SECRET/);
  });

  it('refuses a too-short secret in production but allows it in development', () => {
    expect(() => loadRuntimeConfig({ JWT_SECRET: 'short', NODE_ENV: 'production' })).toThrow(
      /JWT_SECRET/,
    );

    expect(loadRuntimeConfig({ JWT_SECRET: 'short', NODE_ENV: 'development' }).jwtExpiresIn).toBe(
      '12h',
    );
  });

  it('bounds the bcrypt work factor to a sane range', () => {
    expect(() => loadRuntimeConfig({ ...baseEnv, BCRYPT_ROUNDS: '4' })).toThrow(/BCRYPT_ROUNDS/);
    expect(() => loadRuntimeConfig({ ...baseEnv, BCRYPT_ROUNDS: '99' })).toThrow(/BCRYPT_ROUNDS/);
    expect(loadRuntimeConfig({ ...baseEnv, BCRYPT_ROUNDS: '12' }).bcryptRounds).toBe(12);
  });

  it('defaults the bcrypt work factor when unset', () => {
    expect(loadRuntimeConfig({ ...baseEnv }).bcryptRounds).toBe(10);
  });
});

describe('request log scrubbing', () => {
  it('replaces booking and trip identifiers with a placeholder', () => {
    expect(scrubPath('/api/v1/bookings/1f0a9c8e-1111-2222-3333-444455556666')).toBe(
      '/api/v1/bookings/:id',
    );
    expect(scrubPath('/api/v1/trips/abc-123/cancel')).toBe('/api/v1/trips/:id/cancel');
  });

  it('drops the query string so tokens and search terms never reach logs', () => {
    expect(scrubPath('/api/v1/realtime/stream?token=secret-jwt')).toBe('/api/v1/realtime/stream');
  });

  it('leaves collection routes untouched', () => {
    expect(scrubPath('/api/v1/bookings')).toBe('/api/v1/bookings');
  });
});

describe('security headers', () => {
  interface FakeResponse {
    setHeader: jest.Mock;
    removeHeader: jest.Mock;
  }

  function applyHeaders(): Record<string, string> {
    const res: FakeResponse = { setHeader: jest.fn(), removeHeader: jest.fn() };
    const middleware = new SecurityHeadersMiddleware();
    middleware.use(emptyRequest, res as never, () => undefined);

    return Object.fromEntries(
      res.setHeader.mock.calls.map(([key, value]) => [key as string, value as string]),
    );
  }

  it('sets clickjacking, sniffing, and caching protections', () => {
    const headers = applyHeaders();

    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Content-Security-Policy']).toContain("default-src 'none'");
    // Booking payloads contain personal and location data.
    expect(headers['Cache-Control']).toBe('no-store');
    expect(headers['Referrer-Policy']).toBe('no-referrer');
    // Geolocation is needed by the booking flow; camera and microphone are not.
    expect(headers['Permissions-Policy']).toContain('geolocation=(self)');
    expect(headers['Permissions-Policy']).toContain('camera=()');
  });

  it('strips legacy caching headers that could serve stale booking data', () => {
    const res: FakeResponse = { setHeader: jest.fn(), removeHeader: jest.fn() };
    new SecurityHeadersMiddleware().use(emptyRequest, res as never, () => undefined);

    expect(res.removeHeader).toHaveBeenCalledWith('Pragma');
    expect(res.removeHeader).toHaveBeenCalledWith('Expires');
  });
});

describe('readiness probe', () => {
  function serviceWith(stub: Pick<PrismaService, '$queryRaw'>): HealthService {
    return new HealthService(stub as unknown as PrismaService);
  }

  it('reports ok when the database answers', async () => {
    const service = serviceWith({ $queryRaw: async () => [{ '1': 1 }] } as never);
    const report = await service.checkReadiness();

    expect(report.status).toBe('ok');
    expect(report.checks.database.status).toBe('up');
  });

  it('reports degraded without leaking the underlying error message', async () => {
    const service = serviceWith({
      $queryRaw: async () => {
        throw new Error('connect ECONNREFUSED 10.0.0.5:5432 password=hunter2');
      },
    } as never);

    const report = await service.checkReadiness();

    expect(report.status).toBe('degraded');
    expect(report.checks.database.status).toBe('down');
    // Only the error category, never the message carrying connection details.
    expect(report.checks.database.reason).toBe('Error');
    expect(JSON.stringify(report)).not.toContain('hunter2');
  });
});
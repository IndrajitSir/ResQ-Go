import { requireEnv } from '@abs/config';

/**
 * Runtime configuration.
 *
 * The API reads its configuration once, at bootstrap, and validates it before
 * it starts accepting traffic. Failing here produces one actionable message;
 * failing later produces a stream of confusing runtime errors.
 */

export interface RuntimeConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  /** Origins allowed to call the API with credentials. */
  corsOrigins: string[];
  jwtExpiresIn: string;
  bcryptRounds: number;
}

const DEFAULT_DEV_ORIGIN = 'http://localhost:3000';
const MIN_BCRYPT_ROUNDS = 10;
const MAX_BCRYPT_ROUNDS = 15;

function parseOrigins(raw: string | undefined): string[] {
  const value = (raw ?? '').trim();
  if (value === '') {
    return [DEFAULT_DEV_ORIGIN];
  }
  const origins = value
    .split(',')
    .map((entry) => entry.trim().replace(/\/+$/, ''))
    .filter((entry) => entry.length > 0);

  const invalid = origins.filter((origin) => {
    if (origin === '*') return true;
    try {
      const url = new URL(origin);
      return url.protocol !== 'http:' && url.protocol !== 'https:';
    } catch {
      return true;
    }
  });

  if (invalid.length > 0) {
    throw new Error(
      `Invalid CORS_ORIGIN value(s): ${invalid.join(', ')}. ` +
        'Provide absolute http(s) origins separated by commas.',
    );
  }
  return origins;
}

function parseBcryptRounds(raw: string | undefined): number {
  const value = (raw ?? '').trim();
  if (value === '') return MIN_BCRYPT_ROUNDS;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid BCRYPT_ROUNDS: "${value}". Expected an integer.`);
  }
  if (parsed < MIN_BCRYPT_ROUNDS || parsed > MAX_BCRYPT_ROUNDS) {
    throw new Error(
      `BCRYPT_ROUNDS must be between ${MIN_BCRYPT_ROUNDS} and ${MAX_BCRYPT_ROUNDS} (received ${parsed}).`,
    );
  }
  return parsed;
}

/**
 * Reads and validates configuration from `process.env`.
 *
 * JWT_SECRET is mandatory everywhere: a development default would make it easy
 * to ship a known signing key, so even local runs must opt in explicitly.
 */
export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const jwtSecret = requireEnv('JWT_SECRET', env.JWT_SECRET);

  const nodeEnv = env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';

  // Refuse obviously unsafe production settings rather than shipping them.
  if (isProduction) {
    const weakSecrets = [
      'change-me-in-local-dev-only',
      'test-only-secret-do-not-use-outside-tests',
      'secret',
      'changeme',
    ];
    if (weakSecrets.includes(jwtSecret.trim()) || jwtSecret.trim().length < 32) {
      throw new Error(
        'JWT_SECRET is set to a known or too-short value. Generate a strong secret, e.g. ' +
          'node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
      );
    }
  }

  const port = Number.parseInt(env.PORT ?? '', 10);

  return {
    nodeEnv,
    isProduction,
    port: Number.isFinite(port) ? port : 3001,
    corsOrigins: parseOrigins(env.CORS_ORIGIN),
    jwtExpiresIn: env.JWT_EXPIRES_IN?.trim() || '12h',
    bcryptRounds: parseBcryptRounds(env.BCRYPT_ROUNDS),
  };
}


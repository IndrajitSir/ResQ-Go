/** Shared runtime constants and environment helpers. */

export const API_PORT_DEFAULT = 3001;
export const WEB_PORT_DEFAULT = 3000;

export const API_V1_PREFIX = 'api/v1';

/**
 * Parses an integer env var with a fallback. Never throws for missing values;
 * only non-numeric provided values fall back.
 */
export function intFromEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function requireEnv(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

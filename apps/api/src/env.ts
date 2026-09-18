import { config } from 'dotenv';
import { resolve } from 'path';

/**
 * Loads environment variables the way the repository documents them:
 * `apps/api/.env` overrides the shared repo-root `.env`.
 *
 * Values that already exist in the real process environment always win, so
 * container/CI configuration is never overwritten by a stray file.
 *
 * Imported first in `main.ts` (and by `seed.ts` consumers) so configuration is
 * present before any module reads `process.env`.
 */
config({ path: [resolve(__dirname, '../.env'), resolve(__dirname, '../../../.env')] });

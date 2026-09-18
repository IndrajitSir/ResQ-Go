/**
 * Runs a command with environment variables loaded from the same files the API
 * itself uses: `apps/api/.env` first, then the repo root `.env`.
 *
 * The Prisma CLI only reads a `.env` next to its schema, so scripts that need
 * `DATABASE_URL` (db:push, db:seed, migrate) go through this wrapper instead of
 * forcing developers to duplicate the root `.env` into the app folder.
 *
 * Values already present in the real environment always win.
 */
import { spawn } from 'node:child_process';
import { config } from 'dotenv';

config({ path: ['.env', '../../.env'] });

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('usage: node scripts/with-env.mjs <command> [args...]');
  process.exit(1);
}

const child = spawn(command, args, { stdio: 'inherit', env: process.env });
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

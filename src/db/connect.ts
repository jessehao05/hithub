import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

/**
 * Connects for CLI scripts run under tsx, which — unlike `next dev` — does not
 * load `.env.local` on its own. Deliberately a function rather than a
 * module-scope connection: imports are evaluated before any calling statement,
 * so reading DATABASE_URL at import time would run before the env file loads.
 */
export function connect() {
  process.loadEnvFile('.env.local');
  return drizzle(neon(process.env.DATABASE_URL!));
}

export type Db = ReturnType<typeof connect>;

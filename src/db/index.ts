import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

/**
 * The app's connection. Next.js loads `.env.local` itself, so unlike
 * `connect()` in ./connect.ts — which exists because tsx does not — this reads
 * the environment directly and is created once at module scope.
 */
export const db = drizzle(neon(process.env.DATABASE_URL!));

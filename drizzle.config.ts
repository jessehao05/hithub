import { defineConfig } from 'drizzle-kit';

// drizzle-kit auto-loads `.env`, but Next.js puts local secrets in `.env.local`.
if (!process.env.DATABASE_URL) process.loadEnvFile('.env.local');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL },
});

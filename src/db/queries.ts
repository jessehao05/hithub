import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from './index';
import { activities, users } from './schema';

export async function getUserByUsername(username: string) {
  const [user] = await db.select().from(users).where(eq(users.username, username));
  return user ?? null;
}

/** Minutes summed per calendar day, keyed by 'YYYY-MM-DD'. Bounds inclusive. */
export async function getMinutesByDate(userId: string, from: string, to: string) {
  const rows = await db
    .select({
      playedOn: activities.playedOn,
      minutes: sql<number>`sum(${activities.durationMinutes})::int`,
    })
    .from(activities)
    .where(
      and(
        eq(activities.userId, userId),
        gte(activities.playedOn, from),
        lte(activities.playedOn, to),
      ),
    )
    .groupBy(activities.playedOn);

  return new Map(rows.map((r) => [r.playedOn, r.minutes]));
}

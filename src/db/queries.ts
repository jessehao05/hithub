import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from './index';
import { activities, activityPartners, locations, partners, users } from './schema';

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

export function getPartners(userId: string) {
  return db.select().from(partners).where(eq(partners.userId, userId)).orderBy(asc(partners.name));
}

export function getLocations(userId: string) {
  return db.select().from(locations).where(eq(locations.userId, userId)).orderBy(asc(locations.name));
}

/**
 * Returns ids for `names`, creating any that are new. The (user_id, name)
 * unique constraint makes this the point where re-typing an existing name
 * resolves to the existing row instead of forking a duplicate person.
 */
export async function upsertPartners(userId: string, names: string[]) {
  if (names.length === 0) return [];
  const rows = await db
    .insert(partners)
    .values(names.map((name) => ({ userId, name })))
    .onConflictDoUpdate({
      target: [partners.userId, partners.name],
      set: { name: sql`excluded.name` },
    })
    .returning({ id: partners.id });
  return rows.map((r) => r.id);
}

/** Same upsert, for a single location. */
export async function upsertLocation(userId: string, name: string) {
  const [row] = await db
    .insert(locations)
    .values({ userId, name })
    .onConflictDoUpdate({
      target: [locations.userId, locations.name],
      set: { name: sql`excluded.name` },
    })
    .returning({ id: locations.id });
  return row.id;
}

export async function createActivity(input: {
  userId: string;
  playedOn: string;
  durationMinutes: number;
  title: string;
  videoUrl: string | null;
  locationId: string | null;
  partnerIds: string[];
}) {
  const { partnerIds, ...activity } = input;
  const [row] = await db.insert(activities).values(activity).returning({ id: activities.id });

  if (partnerIds.length > 0) {
    await db
      .insert(activityPartners)
      .values(partnerIds.map((partnerId) => ({ activityId: row.id, partnerId })));
  }
  return row.id;
}

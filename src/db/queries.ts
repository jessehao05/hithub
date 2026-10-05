import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from './index';
import { activities, activityPartners, partners, users } from './schema';

export async function getUserByUsername(username: string) {
  const [user] = await db.select().from(users).where(eq(users.username, username));
  return user ?? null;
}

/**
 * The year of the earliest activity, or null when there are none. The year
 * selector spans this to the current year, so a year with nothing logged still
 * gets an entry rather than a gap.
 */
export async function getFirstActivityYear(userId: string) {
  const [row] = await db
    .select({
      year: sql<number | null>`extract(year from min(${activities.playedOn}))::int`,
    })
    .from(activities)
    .where(eq(activities.userId, userId));
  return row.year;
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

/**
 * Totals for any inclusive range. The month state and the day state of the
 * tennis activity section are the same call with different bounds.
 */
export async function getRangeSummary(userId: string, from: string, to: string) {
  const [row] = await db
    .select({
      sessions: sql<number>`count(*)::int`,
      minutes: sql<number>`coalesce(sum(${activities.durationMinutes}), 0)::int`,
    })
    .from(activities)
    .where(
      and(
        eq(activities.userId, userId),
        gte(activities.playedOn, from),
        lte(activities.playedOn, to),
      ),
    );
  return row;
}

/** Sessions in a range, oldest first, each with its partner names. */
export async function getSessionsInRange(userId: string, from: string, to: string) {
  const rows = await db
    .select({
      id: activities.id,
      playedOn: activities.playedOn,
      title: activities.title,
      durationMinutes: activities.durationMinutes,
      videoUrl: activities.videoUrl,
    })
    .from(activities)
    .where(
      and(
        eq(activities.userId, userId),
        gte(activities.playedOn, from),
        lte(activities.playedOn, to),
      ),
    )
    .orderBy(asc(activities.playedOn), asc(activities.createdAt));

  if (rows.length === 0) return [];

  const links = await db
    .select({ activityId: activityPartners.activityId, name: partners.name })
    .from(activityPartners)
    .innerJoin(partners, eq(partners.id, activityPartners.partnerId))
    .where(
      inArray(
        activityPartners.activityId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(partners.name));

  const namesByActivity = new Map<string, string[]>();
  for (const link of links) {
    const names = namesByActivity.get(link.activityId) ?? [];
    names.push(link.name);
    namesByActivity.set(link.activityId, names);
  }

  return rows.map((row) => ({ ...row, partners: namesByActivity.get(row.id) ?? [] }));
}

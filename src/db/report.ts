import { desc, eq, sql } from 'drizzle-orm';
import { connect } from './connect';
import { activities, activityPartners, locations, partners, users } from './schema';

/**
 * Prints a user's totals using the aggregations the app itself will run, so
 * the numbers can be checked by hand before any UI exists.
 *
 *   npm run report            // defaults to the seed user
 *   npm run report -- alice
 */
async function main() {
  const username = process.argv[2] ?? 'jesse';
  const db = connect();

  const [user] = await db.select().from(users).where(eq(users.username, username));
  if (!user) {
    console.error(`No user named '${username}'. Run \`npm run seed\` first.`);
    process.exitCode = 1;
    return;
  }
  const userId = user.id;
  const minutes = sql<number>`sum(${activities.durationMinutes})::int`;

  const [totals] = await db
    .select({ sessions: sql<number>`count(*)::int`, minutes })
    .from(activities)
    .where(eq(activities.userId, userId));
  console.log(`${username}: ${totals.minutes / 60} hours in ${totals.sessions} sessions`);

  const byDay = await db
    .select({ playedOn: activities.playedOn, minutes })
    .from(activities)
    .where(eq(activities.userId, userId))
    .groupBy(activities.playedOn)
    .orderBy(activities.playedOn);

  // Same buckets as the heatmap: 0-1h, 1-2h, 2-3h, 3h+.
  const levels = [0, 0, 0, 0, 0];
  for (const d of byDay) {
    const hours = d.minutes / 60;
    levels[hours <= 1 ? 1 : hours <= 2 ? 2 : hours <= 3 ? 3 : 4]++;
  }
  console.log(
    `Days played: ${byDay.length} — level 1: ${levels[1]}, 2: ${levels[2]}, 3: ${levels[3]}, 4: ${levels[4]}`,
  );
  console.log(`playedOn comes back as: ${typeof byDay[0].playedOn} (${byDay[0].playedOn})\n`);

  const byPartner = await db
    .select({ name: partners.name, sessions: sql<number>`count(*)::int`, minutes })
    .from(activityPartners)
    .innerJoin(partners, eq(partners.id, activityPartners.partnerId))
    .innerJoin(activities, eq(activities.id, activityPartners.activityId))
    .where(eq(activities.userId, userId))
    .groupBy(partners.name)
    .orderBy(desc(minutes));
  console.log('Most played with:');
  for (const p of byPartner) {
    console.log(`  ${p.name.padEnd(14)} ${p.minutes / 60} hours over ${p.sessions} sessions`);
  }

  const byLocation = await db
    .select({ name: locations.name, sessions: sql<number>`count(*)::int`, minutes })
    .from(activities)
    .innerJoin(locations, eq(locations.id, activities.locationId))
    .where(eq(activities.userId, userId))
    .groupBy(locations.name)
    .orderBy(desc(minutes));
  console.log('Most played at:');
  for (const l of byLocation) {
    console.log(`  ${l.name.padEnd(20)} ${l.minutes / 60} hours over ${l.sessions} sessions`);
  }
}

main();

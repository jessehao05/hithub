import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { connect } from './connect';
import { activities, activityPartners, locations, partners, users } from './schema';

const SEED_USER = { username: 'jesse', email: 'jesse.z.hao@vanderbilt.edu' };
const PARTNER_NAMES = ['Alex Chen', 'Sam Rivera', 'Jordan Blake', 'Priya Nair'];
const LOCATION_NAMES = ['Centennial Park', 'Shelby Park Courts', 'Vanderbilt Rec'];

type SeedActivity = {
  daysAgo: number;
  minutes: number;
  title: string;
  partners: string[];
  location: string;
  videoUrl?: string;
};

// 32 sessions over 27 days, spread across the last year. Day totals are chosen
// to land in every color bucket, including exactly on the 1h / 2h / 3h
// boundaries, and four of the days are multi-session so the grid has to sum
// rather than read a single row.
const SEED_ACTIVITIES: SeedActivity[] = [
  { daysAgo: 2, minutes: 90, title: 'Baseline rally drills', partners: ['Alex Chen'], location: 'Centennial Park' },
  { daysAgo: 4, minutes: 60, title: 'Serve practice', partners: [], location: 'Vanderbilt Rec' },
  // 3.75h across two sessions
  { daysAgo: 5, minutes: 120, title: 'Morning doubles', partners: ['Alex Chen', 'Sam Rivera', 'Jordan Blake'], location: 'Centennial Park' },
  { daysAgo: 5, minutes: 105, title: 'Evening singles — 3 sets', partners: ['Sam Rivera'], location: 'Centennial Park', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  { daysAgo: 9, minutes: 75, title: 'Cross-court consistency', partners: ['Priya Nair'], location: 'Shelby Park Courts' },
  { daysAgo: 12, minutes: 45, title: 'Quick hit before work', partners: ['Alex Chen'], location: 'Vanderbilt Rec' },
  { daysAgo: 14, minutes: 120, title: 'Match play vs Jordan', partners: ['Jordan Blake'], location: 'Centennial Park' },
  // 2.5h across two sessions
  { daysAgo: 18, minutes: 90, title: 'Sunday doubles', partners: ['Alex Chen', 'Priya Nair', 'Sam Rivera'], location: 'Shelby Park Courts' },
  { daysAgo: 18, minutes: 60, title: 'Volley and overhead drills', partners: ['Alex Chen'], location: 'Shelby Park Courts' },
  { daysAgo: 23, minutes: 60, title: 'Return of serve work', partners: ['Sam Rivera'], location: 'Vanderbilt Rec' },
  { daysAgo: 27, minutes: 135, title: 'Long practice set', partners: ['Alex Chen'], location: 'Centennial Park', videoUrl: 'https://www.youtube.com/watch?v=5qap5aO4i9A' },
  { daysAgo: 33, minutes: 90, title: 'Doubles with the Thursday group', partners: ['Jordan Blake', 'Priya Nair'], location: 'Shelby Park Courts' },
  // 3.5h across three sessions
  { daysAgo: 38, minutes: 60, title: 'Warmup and footwork', partners: [], location: 'Centennial Park' },
  { daysAgo: 38, minutes: 60, title: 'Singles vs Alex', partners: ['Alex Chen'], location: 'Centennial Park' },
  { daysAgo: 38, minutes: 90, title: 'Doubles to close out the day', partners: ['Alex Chen', 'Sam Rivera', 'Jordan Blake'], location: 'Centennial Park' },
  { daysAgo: 45, minutes: 105, title: 'Tiebreak practice', partners: ['Sam Rivera'], location: 'Vanderbilt Rec' },
  { daysAgo: 52, minutes: 30, title: 'Short hitting session', partners: ['Priya Nair'], location: 'Vanderbilt Rec' },
  { daysAgo: 60, minutes: 120, title: 'Full match — went to three', partners: ['Alex Chen'], location: 'Centennial Park' },
  { daysAgo: 68, minutes: 90, title: 'Approach shots and net play', partners: ['Jordan Blake'], location: 'Shelby Park Courts' },
  { daysAgo: 75, minutes: 150, title: 'Saturday morning doubles marathon', partners: ['Alex Chen', 'Sam Rivera', 'Priya Nair'], location: 'Centennial Park' },
  { daysAgo: 84, minutes: 60, title: 'Slice backhand drills', partners: ['Priya Nair'], location: 'Vanderbilt Rec' },
  // 3.5h across two sessions
  { daysAgo: 93, minutes: 90, title: 'Practice sets', partners: ['Alex Chen'], location: 'Shelby Park Courts' },
  { daysAgo: 93, minutes: 120, title: 'Doubles under the lights', partners: ['Alex Chen', 'Jordan Blake', 'Sam Rivera'], location: 'Shelby Park Courts', videoUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' },
  { daysAgo: 117, minutes: 120, title: 'Match play vs Sam', partners: ['Sam Rivera'], location: 'Centennial Park' },
  { daysAgo: 129, minutes: 45, title: 'Serve and return only', partners: [], location: 'Vanderbilt Rec' },
  { daysAgo: 141, minutes: 90, title: 'Winter indoor session', partners: ['Alex Chen'], location: 'Vanderbilt Rec' },
  { daysAgo: 156, minutes: 180, title: 'Club round robin', partners: ['Alex Chen', 'Sam Rivera', 'Jordan Blake', 'Priya Nair'], location: 'Vanderbilt Rec', videoUrl: 'https://www.youtube.com/watch?v=9bZkp7q19f0' },
  { daysAgo: 182, minutes: 105, title: 'Groundstroke depth drills', partners: ['Priya Nair'], location: 'Shelby Park Courts' },
  { daysAgo: 197, minutes: 90, title: 'Doubles with Jordan and Sam', partners: ['Jordan Blake', 'Sam Rivera'], location: 'Centennial Park' },
  { daysAgo: 213, minutes: 240, title: 'Weekend tournament — three rounds', partners: ['Alex Chen'], location: 'Vanderbilt Rec', videoUrl: 'https://www.youtube.com/watch?v=kJQP7kiw5Fk' },
  { daysAgo: 251, minutes: 120, title: 'Long rally session', partners: ['Alex Chen'], location: 'Centennial Park' },
  { daysAgo: 344, minutes: 90, title: 'First session of the year', partners: ['Sam Rivera'], location: 'Shelby Park Courts' },
];

/**
 * A calendar day N days back, as 'YYYY-MM-DD'. Built from local date parts —
 * `toISOString()` would convert through UTC and shift the day for evening
 * dates in a negative-offset timezone, which is the exact bug the DATE column
 * exists to avoid.
 */
function dateDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

async function main() {
  const db = connect();

  // Re-runnable: deleting the seed user cascades to their partners,
  // locations, activities, and activity_partners. Only this user is touched.
  await db.delete(users).where(eq(users.username, SEED_USER.username));

  const [user] = await db.insert(users).values(SEED_USER).returning();

  const partnerRows = await db
    .insert(partners)
    .values(PARTNER_NAMES.map((name) => ({ userId: user.id, name })))
    .returning();
  const locationRows = await db
    .insert(locations)
    .values(LOCATION_NAMES.map((name) => ({ userId: user.id, name })))
    .returning();

  const partnerIdByName = new Map(partnerRows.map((p) => [p.name, p.id]));
  const locationIdByName = new Map(locationRows.map((l) => [l.name, l.id]));

  // Ids are generated up front so the join rows can be batched alongside the
  // activities instead of inserting one at a time to read each id back.
  const activityRows = SEED_ACTIVITIES.map((a) => ({
    id: randomUUID(),
    userId: user.id,
    playedOn: dateDaysAgo(a.daysAgo),
    durationMinutes: a.minutes,
    title: a.title,
    videoUrl: a.videoUrl ?? null,
    locationId: locationIdByName.get(a.location)!,
  }));
  await db.insert(activities).values(activityRows);

  const joinRows = SEED_ACTIVITIES.flatMap((a, i) =>
    a.partners.map((name) => ({
      activityId: activityRows[i].id,
      partnerId: partnerIdByName.get(name)!,
    })),
  );
  await db.insert(activityPartners).values(joinRows);

  console.log(
    `Seeded ${SEED_USER.username}: ${activityRows.length} activities, ` +
      `${partnerRows.length} partners, ${locationRows.length} locations, ${joinRows.length} partner links.`,
  );
  console.log('Run `npm run report` to check the aggregates.');
}

main();

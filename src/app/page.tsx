import Link from 'next/link';
import { connection } from 'next/server';
import { Heatmap } from '@/components/heatmap';
import { getMinutesByDate, getUserByUsername } from '@/db/queries';
import { buildWeeks, calendarRange, formatHours, today } from '@/lib/heatmap';
import { CURRENT_USERNAME as USERNAME } from '@/lib/user';

export default async function Home() {
  // Render per request. Without this the page prerenders at build time, which
  // would freeze both the activity data and `today` at whenever the build ran.
  await connection();

  const user = await getUserByUsername(USERNAME);
  if (!user) {
    return (
      <main className="mx-auto w-full max-w-4xl p-8">
        <p>
          No user named <strong>{USERNAME}</strong>. Run <code>npm run seed</code>.
        </p>
      </main>
    );
  }

  // One `today` for both, so the queried range and the rendered grid can't disagree.
  const currentDay = today();
  const { from, to } = calendarRange(currentDay);
  const minutesByDate = await getMinutesByDate(user.id, from, to);
  const weeks = buildWeeks(minutesByDate, currentDay);

  const totalMinutes = [...minutesByDate.values()].reduce((sum, m) => sum + m, 0);

  return (
    <main className="mx-auto w-full max-w-4xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{user.username}</h1>
        <Link
          href="/new"
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium"
        >
          Log a session
        </Link>
      </div>

      <section className="mt-6 rounded-md border border-border p-4">
        <h2 className="mb-3 text-sm">
          {formatHours(totalMinutes)} hours of tennis in the last year
        </h2>

        <Heatmap weeks={weeks} />

        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted">
          Less
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              key={level}
              className="size-[11px] rounded-[2px]"
              style={{ background: `var(--heat-${level})` }}
            />
          ))}
          More
        </div>
      </section>
    </main>
  );
}

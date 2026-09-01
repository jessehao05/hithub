import Link from 'next/link';
import { connection } from 'next/server';
import { Heatmap, HeatmapLegend } from '@/components/heatmap';
import { TennisActivity } from '@/components/tennis-activity';
import { getMinutesByDate, getUserByUsername } from '@/db/queries';
import {
  buildWeeks,
  calendarRange,
  formatHours,
  formatMonth,
  formatMonthDay,
  formatMonthName,
  monthRange,
  today,
} from '@/lib/heatmap';
import { CURRENT_USERNAME as USERNAME } from '@/lib/user';

export default async function Home({ searchParams }: PageProps<'/'>) {
  // Render per request. Without this the page prerenders at build time, which
  // would freeze both the activity data and `today` at whenever the build ran.
  await connection();

  const user = await getUserByUsername(USERNAME);
  if (!user) {
    return (
      <main className="mx-auto w-full max-w-5xl px-8 py-16">
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

  // A day is selectable only if the grid is actually showing it.
  const { day } = await searchParams;
  const selected =
    typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= from && day <= to
      ? day
      : undefined;

  // The default month is the last month in the displayed range, which is the
  // current month here and December once a past year can be selected. A
  // selected day narrows the same component to a single-day range.
  const defaultMonth = to.slice(0, 7);
  const range = selected ? { from: selected, to: selected } : monthRange(defaultMonth);
  const heading = selected
    ? { primary: formatMonthDay(selected), secondary: `, ${selected.slice(0, 4)}` }
    : { primary: formatMonthName(defaultMonth), secondary: ` ${defaultMonth.slice(0, 4)}` };

  return (
    <main className="mx-auto w-full max-w-5xl px-8 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">{user.username}</h1>
        <Link
          href="/new"
          className="rounded-md border px-3 py-1.5 text-sm font-medium"
          style={{ borderColor: 'var(--border)' }}
        >
          Log a session
        </Link>
      </div>

      <h2 className="mt-10 text-base">
        {formatHours(totalMinutes)} hours of tennis in the last year
      </h2>

      {/* The card hugs the grid; the column beside it is the year selector's. */}
      <div className="mt-2 flex items-start gap-6">
        <div
          className="min-w-0 rounded-md border p-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <Heatmap weeks={weeks} selected={selected} />

          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted">1 hour of tennis is one activity</span>
            <HeatmapLegend />
          </div>
        </div>

        <div className="w-24 shrink-0" />
      </div>

      {selected && (
        <Link
          href="/"
          scroll={false}
          className="mt-8 inline-block text-sm text-muted hover:underline"
        >
          &larr; Back to {formatMonth(defaultMonth)}
        </Link>
      )}

      <TennisActivity
        userId={user.id}
        from={range.from}
        to={range.to}
        heading={heading}
        withSessions={Boolean(selected)}
      />
    </main>
  );
}

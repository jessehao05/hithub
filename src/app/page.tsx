import Link from 'next/link';
import { connection } from 'next/server';
import { Heatmap, HeatmapLegend } from '@/components/heatmap';
import { TennisActivity } from '@/components/tennis-activity';
import { YearSelector } from '@/components/year-selector';
import { getFirstActivityYear, getMinutesByDate, getUserByUsername } from '@/db/queries';
import {
  buildWeeks,
  formatHours,
  formatMonth,
  formatMonthDay,
  formatMonthName,
  monthRange,
  rollingRange,
  today,
  yearRange,
} from '@/lib/heatmap';
import { homeHref } from '@/lib/links';
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
  const currentYear = Number(currentDay.slice(0, 4));
  const { day, year } = await searchParams;

  // Every year from the first logged session to now, newest first. The newest
  // is the rolling view rather than a calendar year, so selecting it is the
  // same as selecting nothing.
  const firstYear = (await getFirstActivityYear(user.id)) ?? currentYear;
  const years = Array.from(
    { length: Math.max(currentYear - firstYear, 0) + 1 },
    (_, i) => currentYear - i,
  );
  const selectedYear =
    typeof year === 'string' && years.includes(Number(year)) && Number(year) !== currentYear
      ? Number(year)
      : undefined;

  const { from, to } = selectedYear ? yearRange(selectedYear) : rollingRange(currentDay);
  const minutesByDate = await getMinutesByDate(user.id, from, to);
  const weeks = buildWeeks(minutesByDate, { from, to });

  const totalMinutes = [...minutesByDate.values()].reduce((sum, m) => sum + m, 0);

  // A day is selectable only if the grid is actually showing it.
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
      <h1 className="text-2xl">{user.username}</h1>

      <h2 className="mt-10 text-base">
        {formatHours(totalMinutes)} hours of tennis{' '}
        {selectedYear ? `in ${selectedYear}` : 'in the last year'}
      </h2>

      {/* The card hugs the grid; the year selector sits flush with the header's right edge. */}
      <div className="mt-2 flex items-start justify-between gap-6">
        <div
          className="min-w-0 rounded-md border p-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <Heatmap weeks={weeks} selected={selected} year={selectedYear} />

          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted">1 hour of tennis is one activity</span>
            <HeatmapLegend />
          </div>
        </div>

        <YearSelector years={years} selected={selectedYear} />
      </div>

      {selected && (
        <Link
          href={homeHref({ year: selectedYear })}
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

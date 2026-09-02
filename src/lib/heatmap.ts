/**
 * Grid math for the contribution heatmap. Pure functions over 'YYYY-MM-DD'
 * strings — no Date ever crosses into the rendered output, so there is no
 * timezone conversion that could move a session to the wrong square.
 */

/** Upper bounds in hours for levels 1-3; anything above the last is level 4. */
export const LEVEL_THRESHOLD_HOURS = [1, 2, 3];

export const WEEKS = 53;

/**
 * The calendar the app thinks in. Every "what day is it" answer comes from
 * here rather than the server clock, which is UTC on Vercel — otherwise an
 * evening session would default to tomorrow's date and the grid would start a
 * new day early. Change this one line to move zones.
 */
export const TIMEZONE = 'America/Chicago';

export type Day = { date: string; minutes: number; level: number };

export function levelForMinutes(minutes: number): number {
  if (minutes <= 0) return 0;
  const hours = minutes / 60;
  return 1 + LEVEL_THRESHOLD_HOURS.filter((t) => hours > t).length;
}

/** Today's calendar date in TIMEZONE, as 'YYYY-MM-DD'. */
export function today(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Calendar date as 'YYYY-MM-DD'. `toISOString()` would convert through UTC. */
function toDateString(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Midnight local to the running process. Only ever used as a cursor for adding
 * days and reading back the parts, so the process zone cancels out.
 */
function fromDateString(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export type Range = { from: string; to: string };

/** Every column is a whole week, so both range ends round out to one. */
function sundayOnOrBefore(date: string): Date {
  const start = fromDateString(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

/**
 * The default view: 53 whole weeks ending with the current one. `from` lands on
 * a Sunday, so the grid opens on a full column.
 */
export function rollingRange(today: string): Range {
  const start = sundayOnOrBefore(today);
  start.setDate(start.getDate() - (WEEKS - 1) * 7);
  return { from: toDateString(start), to: today };
}

/** Inclusive bounds of a calendar year, which is what a past year shows. */
export function yearRange(year: number): Range {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/**
 * Sunday-first columns of 7 days covering the range. Days outside it are null,
 * so the grid stays rectangular while its first and last columns render as
 * partial — the current week in the rolling view, the weeks a calendar year
 * shares with its neighbours in a year view.
 */
export function buildWeeks(
  minutesByDate: Map<string, number>,
  { from, to }: Range,
): (Day | null)[][] {
  const cursor = sundayOnOrBefore(from);
  const weeks: (Day | null)[][] = [];

  // A week whose Sunday is within the range holds at least one of its days.
  while (toDateString(cursor) <= to) {
    weeks.push(
      Array.from({ length: 7 }, () => {
        const date = toDateString(cursor);
        cursor.setDate(cursor.getDate() + 1);
        if (date < from || date > to) return null;
        const minutes = minutesByDate.get(date) ?? 0;
        return { date, minutes, level: levelForMinutes(minutes) };
      }),
    );
  }

  return weeks;
}

/** Inclusive bounds of a 'YYYY-MM' month. */
export function monthRange(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split('-').map(Number);
  // Day 0 of the next month is the last day of this one.
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
}

/** '2026-09' -> 'September'. The year is rendered separately and muted. */
export function formatMonthName(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-US', { month: 'long' });
}

/** '2026-08-15' -> 'August 15'. */
export function formatMonthDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });
}

/** '2026-09' -> 'September 2026'. */
export function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

/** 105 -> '1.75', 120 -> '2'. */
export function formatHours(minutes: number): string {
  return String(Number((minutes / 60).toFixed(2)));
}

/** 105 -> '1.75 hours', 60 -> '1 hour'. */
export function formatHoursLabel(minutes: number): string {
  const value = formatHours(minutes);
  return `${value} ${value === '1' ? 'hour' : 'hours'}`;
}

/** '2026-08-15' -> 'August 15, 2026', built from parts so nothing shifts. */
export function formatDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

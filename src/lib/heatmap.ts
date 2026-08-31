/**
 * Grid math for the contribution heatmap. Pure functions over 'YYYY-MM-DD'
 * strings — no Date ever crosses into the rendered output, so there is no
 * timezone conversion that could move a session to the wrong square.
 */

/** Upper bounds in hours for levels 1-3; anything above the last is level 4. */
export const LEVEL_THRESHOLD_HOURS = [1, 2, 3];

export const WEEKS = 53;

export type Day = { date: string; minutes: number; level: number };

export function levelForMinutes(minutes: number): number {
  if (minutes <= 0) return 0;
  const hours = minutes / 60;
  return 1 + LEVEL_THRESHOLD_HOURS.filter((t) => hours > t).length;
}

/** Local calendar date as 'YYYY-MM-DD'. `toISOString()` would convert through UTC. */
function toDateString(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * The grid spans 53 whole weeks ending with the current one, so it always
 * starts on a Sunday and every column is a full week.
 */
function firstSunday(today: Date): Date {
  const start = new Date(today);
  start.setDate(start.getDate() - today.getDay() - (WEEKS - 1) * 7);
  return start;
}

/** Bounds to query, inclusive. Pass the same `today` used to build the weeks. */
export function calendarRange(today: Date): { from: string; to: string } {
  return { from: toDateString(firstSunday(today)), to: toDateString(today) };
}

/**
 * 53 columns of 7 days, Sunday first. Days after today are null so the grid
 * stays rectangular while the current week renders as partial.
 */
export function buildWeeks(
  minutesByDate: Map<string, number>,
  today: Date,
): (Day | null)[][] {
  const todayString = toDateString(today);
  const cursor = firstSunday(today);

  return Array.from({ length: WEEKS }, () =>
    Array.from({ length: 7 }, () => {
      const date = toDateString(cursor);
      cursor.setDate(cursor.getDate() + 1);
      if (date > todayString) return null;
      const minutes = minutesByDate.get(date) ?? 0;
      return { date, minutes, level: levelForMinutes(minutes) };
    }),
  );
}

/** 105 -> '1.75', 120 -> '2'. */
export function formatHours(minutes: number): string {
  return String(Number((minutes / 60).toFixed(2)));
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

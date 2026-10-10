/**
 * Aggregations over the activity list. What used to be SQL: every function is
 * a pure pass over an array, so the network cost is paid once, in the fetch,
 * and nothing here touches Notion. Dates are 'YYYY-MM-DD' strings, which sort
 * the same alphabetically as chronologically, so plain string comparison is a
 * correct date comparison.
 */

export type Activity = {
  id: string;
  /** A calendar day, never a timestamp. See plan.md, gotcha 1. */
  playedOn: string;
  durationMinutes: number;
  title: string;
  videoUrl: string | null;
  /** Absent, not empty, in restricted mode. */
  partners?: string[];
  /** Absent, not empty, in restricted mode. Stored but not rendered yet. */
  location?: string | null;
};

/** Bounds inclusive. Keeps the input order. */
function inRange(activities: Activity[], from: string, to: string): Activity[] {
  return activities.filter((a) => a.playedOn >= from && a.playedOn <= to);
}

/**
 * The year of the earliest activity, or null when there are none. The year
 * selector spans this to the current year, so a year with nothing logged still
 * gets an entry rather than a gap.
 */
export function firstActivityYear(activities: Activity[]): number | null {
  let first: string | null = null;
  for (const a of activities) if (first === null || a.playedOn < first) first = a.playedOn;
  return first === null ? null : Number(first.slice(0, 4));
}

/** Minutes summed per calendar day, keyed by 'YYYY-MM-DD'. Bounds inclusive. */
export function minutesByDate(activities: Activity[], from: string, to: string) {
  const minutes = new Map<string, number>();
  for (const a of inRange(activities, from, to)) {
    minutes.set(a.playedOn, (minutes.get(a.playedOn) ?? 0) + a.durationMinutes);
  }
  return minutes;
}

/**
 * Totals for any inclusive range. The month state and the day state of the
 * tennis activity section are the same call with different bounds.
 */
export function rangeSummary(activities: Activity[], from: string, to: string) {
  const sessions = inRange(activities, from, to);
  return {
    sessions: sessions.length,
    minutes: sessions.reduce((sum, a) => sum + a.durationMinutes, 0),
  };
}

/**
 * Sessions in a range, oldest first. The fetch returns rows in creation order
 * and `sort` is stable, so sessions on the same day stay in the order they
 * were logged.
 */
export function sessionsInRange(activities: Activity[], from: string, to: string) {
  return inRange(activities, from, to).sort((a, b) => a.playedOn.localeCompare(b.playedOn));
}

import Link from 'next/link';
import { formatDate, formatHoursLabel, type Day } from '@/lib/heatmap';

const CELL = 10;
const GAP = 3;
/** Height of the month-label row; the weekday column pads by this to line up. */
const MONTH_ROW = 13;
const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const columns = {
  display: 'grid',
  gridAutoFlow: 'column',
  gridAutoColumns: `${CELL}px`,
  gap: `${GAP}px`,
} as const;

/** Every cell carries a hairline, which is what makes empty days read as cells. */
const cell = {
  outline: '1px solid var(--cell-border)',
  outlineOffset: '-1px',
} as const;

/**
 * A label is wider than the column it sits in, so a month owning fewer columns
 * than this goes unlabelled rather than printing on top of the next month's
 * label. Only the partial month the grid opens on is ever this narrow.
 */
const MIN_LABEL_COLUMNS = 2;

/** A label sits above the first column whose week starts in a new month. */
function monthLabels(weeks: (Day | null)[][]): (string | null)[] {
  const months = weeks.map((week) => {
    const first = week.find((d) => d !== null);
    return first ? Number(first.date.slice(5, 7)) - 1 : null;
  });

  return months.map((month, i) => {
    if (month === null || month === months[i - 1]) return null;
    let width = 1;
    while (months[i + width] === month) width += 1;
    return width >= MIN_LABEL_COLUMNS ? MONTHS[month] : null;
  });
}

function title(day: Day): string {
  const when = formatDate(day.date);
  return day.minutes === 0
    ? `No tennis on ${when}`
    : `${formatHoursLabel(day.minutes)} on ${when}`;
}

export function Heatmap({
  weeks,
  selected,
}: {
  weeks: (Day | null)[][];
  selected?: string;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto text-xs text-muted">
      <div
        className="grid shrink-0"
        style={{
          gridTemplateRows: `repeat(7, ${CELL}px)`,
          gap: `${GAP}px`,
          paddingTop: `${MONTH_ROW + GAP}px`,
        }}
      >
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="flex items-center leading-none">
            {label}
          </div>
        ))}
      </div>

      <div className="shrink-0">
        <div
          style={{ ...columns, height: `${MONTH_ROW}px`, marginBottom: `${GAP}px` }}
          className="leading-none"
        >
          {monthLabels(weeks).map((label, i) => (
            <div key={i} className="whitespace-nowrap">
              {label}
            </div>
          ))}
        </div>

        <div style={{ ...columns, gridTemplateRows: `repeat(7, ${CELL}px)` }}>
          {weeks.map((week, w) =>
            week.map((day, d) =>
              day ? (
                // Selection lives in the URL, so the grid stays a server
                // component and a linked day is shareable.
                <Link
                  key={`${w}-${d}`}
                  href={day.date === selected ? '/' : `/?day=${day.date}`}
                  scroll={false}
                  title={title(day)}
                  aria-label={title(day)}
                  className="rounded-[2px]"
                  style={{
                    ...cell,
                    background: `var(--heat-${day.level})`,
                    boxShadow:
                      day.date === selected ? '0 0 0 1.5px var(--foreground)' : undefined,
                  }}
                />
              ) : (
                <div key={`${w}-${d}`} />
              ),
            ),
          )}
        </div>
      </div>
    </div>
  );
}

/** Less [] [] [] [] [] More, using the same cell treatment as the grid. */
export function HeatmapLegend() {
  return (
    <div className="flex items-center gap-1 text-xs text-muted">
      Less
      {[0, 1, 2, 3, 4].map((level) => (
        <span
          key={level}
          className="rounded-[2px]"
          style={{
            ...cell,
            width: `${CELL}px`,
            height: `${CELL}px`,
            background: `var(--heat-${level})`,
          }}
        />
      ))}
      More
    </div>
  );
}

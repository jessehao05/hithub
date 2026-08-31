import { formatDate, formatHours, type Day } from '@/lib/heatmap';

const CELL = 11;
const GAP = 3;
const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const columns = {
  display: 'grid',
  gridAutoFlow: 'column',
  gridAutoColumns: `${CELL}px`,
  gap: `${GAP}px`,
} as const;

/** A label sits above the first column whose week starts in a new month. */
function monthLabels(weeks: (Day | null)[][]): (string | null)[] {
  let previous = -1;
  return weeks.map((week) => {
    const first = week.find((d) => d !== null);
    if (!first) return null;
    const month = Number(first.date.slice(5, 7)) - 1;
    if (month === previous) return null;
    previous = month;
    return MONTHS[month];
  });
}

function title(day: Day): string {
  const when = formatDate(day.date);
  return day.minutes === 0
    ? `No tennis on ${when}`
    : `${formatHours(day.minutes)} hours on ${when}`;
}

export function Heatmap({ weeks }: { weeks: (Day | null)[][] }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 text-[10px] text-muted">
      <div
        className="grid shrink-0 pt-[15px]"
        style={{ gridTemplateRows: `repeat(7, ${CELL}px)`, gap: `${GAP}px` }}
      >
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="flex items-center leading-none">
            {label}
          </div>
        ))}
      </div>

      <div className="shrink-0">
        <div style={columns} className="mb-1 h-[11px] leading-none">
          {monthLabels(weeks).map((label, i) => (
            <div key={i}>{label}</div>
          ))}
        </div>

        <div style={{ ...columns, gridTemplateRows: `repeat(7, ${CELL}px)` }}>
          {weeks.map((week, w) =>
            week.map((day, d) => (
              <div
                key={`${w}-${d}`}
                title={day ? title(day) : undefined}
                className="rounded-[2px]"
                style={{
                  background: day ? `var(--heat-${day.level})` : 'transparent',
                }}
              />
            )),
          )}
        </div>
      </div>
    </div>
  );
}

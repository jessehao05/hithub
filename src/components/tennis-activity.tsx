import { getRangeSummary, getSessionsInRange } from '@/db/queries';
import { formatHoursLabel } from '@/lib/heatmap';

/**
 * GitHub's "Contribution activity", for tennis. One component over a date
 * range: a month with no list by default, a single day with its sessions when
 * a square is selected. Both states are the same summary query.
 */
export async function TennisActivity({
  userId,
  from,
  to,
  heading,
  withSessions,
}: {
  userId: string;
  from: string;
  to: string;
  /** Rendered as bold primary + muted secondary, like GitHub's "August 2026". */
  heading: { primary: string; secondary: string };
  withSessions: boolean;
}) {
  const summary = await getRangeSummary(userId, from, to);
  const sessions = withSessions ? await getSessionsInRange(userId, from, to) : [];

  return (
    <section className="mt-12">
      <h2 className="text-lg">Tennis activity</h2>

      <div className="mt-6 ml-2">
        <div className="flex items-center gap-4">
          <h3 className="shrink-0 text-sm">
            <span className="font-semibold">{heading.primary}</span>
            <span className="text-muted">{heading.secondary}</span>
          </h3>
          <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
        </div>

        {/* The rail runs behind a node that masks it with the page background. */}
        <div className="relative ml-4 border-l py-6 pl-8" style={{ borderColor: 'var(--border)' }}>
          <span
            className="absolute top-5 size-[22px] rounded-full"
            style={{
              left: '-11px',
              background: 'var(--node)',
              boxShadow: '0 0 0 4px var(--background)',
            }}
          />

          <p className="text-sm">
            {summary.sessions === 0
              ? 'No tennis logged'
              : `Played ${formatHoursLabel(summary.minutes)} in ${summary.sessions} ${
                  summary.sessions === 1 ? 'session' : 'sessions'
                }`}
          </p>

          {sessions.length > 0 && (
            <ul className="mt-3 flex flex-col gap-3">
              {sessions.map((session) => (
                <li key={session.id}>
                  <div className="flex items-baseline gap-3">
                    <h4 className="text-sm font-medium">{session.title}</h4>
                    <span className="text-xs text-muted">
                      {formatHoursLabel(session.durationMinutes)}
                    </span>
                  </div>
                  <div className="mt-1 pl-3 text-xs text-muted">
                    {session.partners.length > 0 && <p>with: {session.partners.join(', ')}</p>}
                    {session.videoUrl && (
                      <p>
                        YT:{' '}
                        <a
                          href={session.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                          style={{ color: 'var(--accent)' }}
                        >
                          {session.videoUrl}
                        </a>
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

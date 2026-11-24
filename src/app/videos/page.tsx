import { connection } from 'next/server';
import { getActivities } from '@/data/activities';
import { formatDate, formatHoursLabel } from '@/lib/heatmap';

export default async function Videos() {
  // Per request, like the home page, so new rows in Notion show up on reload.
  await connection();

  // Newest first. `sort` is stable, so same-day sessions keep their logged order.
  const videos = (await getActivities())
    .filter((a) => a.videoUrl)
    .sort((a, b) => b.playedOn.localeCompare(a.playedOn));

  return (
    <main className="mx-auto w-full max-w-5xl px-8 py-16">
      <h2 className="text-base">
        {videos.length} {videos.length === 1 ? 'video' : 'videos'}
      </h2>

      {videos.length > 0 && (
        <ul className="mt-4 border-t" style={{ borderColor: 'var(--border)' }}>
          {videos.map((video) => (
            <li
              key={video.id}
              className="flex items-baseline gap-4 border-b py-4"
              style={{ borderColor: 'var(--border)' }}
            >
              <a
                href={video.videoUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                {video.title}
              </a>
              <span className="shrink-0 text-xs text-muted">{formatDate(video.playedOn)}</span>
              <span className="w-20 shrink-0 text-right text-xs text-muted">
                {formatHoursLabel(video.durationMinutes)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

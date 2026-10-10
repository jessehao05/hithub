import Link from 'next/link';
import { homeHref } from '@/lib/links';

/**
 * GitHub's right-hand year rail. The newest entry is the default rolling view
 * rather than a calendar year, which is why it links to `/` with no param —
 * it is the same view the profile opens on, not a third state.
 */
export function YearSelector({
  years,
  selected,
}: {
  years: number[];
  /** Undefined on the rolling view, which highlights the newest year. */
  selected?: number;
}) {
  return (
    <nav className="flex w-24 shrink-0 flex-col gap-1 text-sm">
      {years.map((year, i) => {
        const active = selected === undefined ? i === 0 : year === selected;
        return (
          <Link
            key={year}
            href={homeHref({ year: i === 0 ? undefined : year })}
            scroll={false}
            aria-current={active ? 'page' : undefined}
            className={`rounded-md px-3 py-1.5 ${
              active ? 'font-medium' : 'text-muted hover:bg-[var(--node)]'
            }`}
            // White on the accent in both themes, as GitHub's selected pill is.
            style={active ? { background: 'var(--accent)', color: '#ffffff' } : undefined}
          >
            {year}
          </Link>
        );
      })}
    </nav>
  );
}

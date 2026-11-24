'use client';

import { useEffect, useState } from 'react';

export type Heading = { depth: number; text: string; id: string };

/** A heading becomes current once its top scrolls above this line. */
const ACTIVE_LINE = 80;

/**
 * The Journey page's table of contents, with the section being read marked.
 * Current is the last heading above the line, so a section stays marked for
 * as long as it is being read rather than whenever its heading is in view.
 */
export function JourneyToc({ headings }: { headings: Heading[] }) {
  const [active, setActive] = useState<string | undefined>(headings[0]?.id);

  useEffect(() => {
    // A clicked entry stays marked until the reader scrolls on their own. The
    // last short sections can't reach the line, so the scroll rule alone
    // would mark an earlier heading after jumping to one of them.
    let pinned = false;
    let frame = 0;

    const update = () => {
      frame = 0;
      if (pinned) return;
      let current = headings[0]?.id;
      for (const { id } of headings) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= ACTIVE_LINE) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element).closest('a[data-toc]');
      if (!link) return;
      pinned = true;
      setActive(link.getAttribute('href')!.slice(1));
    };
    const unpin = () => {
      pinned = false;
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onClick);
    for (const type of ['wheel', 'touchmove', 'keydown'])
      window.addEventListener(type, unpin, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick);
      for (const type of ['wheel', 'touchmove', 'keydown']) window.removeEventListener(type, unpin);
    };
  }, [headings]);

  return (
    <nav className="shrink-0 text-sm md:sticky md:top-8 md:w-56 md:self-start">
      <ul className="flex flex-col gap-1">
        {headings.map((heading) => {
          const current = heading.id === active;
          return (
            <li key={heading.id}>
              {/* The bar sits on the link's left edge at every depth; the indent is inside it. */}
              <a
                href={`#${heading.id}`}
                data-toc
                aria-current={current ? 'location' : undefined}
                className={`block border-l-2 py-0.5 pr-2 ${
                  current ? 'font-medium text-foreground' : 'text-muted hover:text-foreground'
                }`}
                style={{
                  borderColor: current ? 'var(--accent)' : 'transparent',
                  paddingLeft: `${8 + (heading.depth - 1) * 12}px`,
                }}
              >
                {heading.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

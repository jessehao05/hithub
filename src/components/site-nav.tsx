'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import icon from '@/app/icon.png';

const tabs = [
  { href: '/', label: 'Overview' },
  { href: '/videos', label: 'Videos' },
  { href: '/journey', label: 'Journey' },
];

/** GitHub's profile header: logo and name on top, underlined tabs beneath. */
export function SiteNav() {
  const pathname = usePathname();

  return (
    <header
      className="border-b px-6 pt-4"
      style={{ background: 'var(--header)', borderColor: 'var(--border)' }}
    >
      <Link href="/" className="inline-flex items-center gap-3">
        <Image src={icon} alt="" width={32} height={32} priority />
        <span className="text-sm font-semibold">hithub</span>
      </Link>

      <nav className="mt-3 flex gap-2 text-sm">
        {tabs.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`border-b-2 pb-2 ${active ? 'font-semibold' : ''}`}
              style={{ borderColor: active ? 'var(--tab-active)' : 'transparent' }}
            >
              <span className="block rounded-md px-2 py-1 hover:bg-[var(--node)]">{label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

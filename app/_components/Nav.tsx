import Link from 'next/link';

/**
 * Five destinations, and no more. The complexity of this app lives under the
 * interface rather than in it — Today answers the question, and the other four
 * are where you go when you want to look at something specific.
 */

const ICONS: Record<string, React.ReactNode> = {
  today: (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2.5 7 5-14L17 12h4" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  goals: (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  ),
  track: (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V9M10 19V5M16 19v-7M22 19v-3" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="5" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  ),
};

const TABS = [
  { href: '/', label: 'Today', icon: 'today' },
  { href: '/calendar', label: 'Calendar', icon: 'calendar' },
  { href: '/goals', label: 'Goals', icon: 'goals' },
  { href: '/track', label: 'Track', icon: 'track' },
  { href: '/more', label: 'More', icon: 'more' },
];

/**
 * The pages that existed before the five-tab structure still pass their own
 * route in. Rather than editing every one of them, map each to the tab it now
 * lives under, so the highlight is right wherever you are.
 */
const HOME: Record<string, string> = {
  '/work': '/track', '/gym': '/track', '/knee': '/track',
  '/log': '/track', '/progress': '/track',
  '/week': '/more', '/reference': '/more', '/settings': '/more',
  '/checkin': '/',
};

export default function Nav({ active }: { active: string }) {
  const on = HOME[active] ?? active;
  return (
    <nav className="tabs">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={t.href === on ? 'on' : ''}>
          <span className="ic">{ICONS[t.icon]}</span>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

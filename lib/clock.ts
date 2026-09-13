/**
 * Times of day, as minutes past midnight.
 *
 * The planner does a great deal of arithmetic on clock times, and doing it on
 * `Date` objects is how you end up with a gym session at 25:15 or a block that
 * silently lands on yesterday. So a time of day is a number here — minutes from
 * midnight — and it only becomes a string at the edge, on the way to a screen.
 *
 * Nothing in this file knows what day it is. That is deliberate: a day boundary
 * is a calendar question and belongs in `plan.ts`.
 */

export const MIN = 1;
export const HOUR = 60;
export const DAY_MINUTES = 24 * 60;

/** '07:30' → 450. Tolerates '7:30', '07:30:00' and a plain number of minutes. */
export function toMin(t: string | number | null | undefined, fallback = 0): number {
  if (t == null) return fallback;
  if (typeof t === 'number') return Number.isFinite(t) ? t : fallback;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return fallback;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return fallback;
  return h * 60 + mm;
}

/** 450 → '07:30'. Wraps past midnight rather than producing '25:15'. */
export function toHHMM(mins: number): string {
  const t = ((Math.round(mins) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** '1 h 20 m', '45 m', '2 h'. */
export function hm(mins: number): string {
  const n = Math.max(0, Math.round(mins));
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (!h) return `${m} m`;
  return m ? `${h} h ${m} m` : `${h} h`;
}

/** '6h 20m' — the compact form for a headline number. */
export function hmShort(mins: number): string {
  const n = Math.max(0, Math.round(mins));
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Decimal hours, one place. */
export function hours(mins: number): number {
  return Math.round((mins / 60) * 10) / 10;
}

/* ------------------------------------------------------------- intervals */

export type Span = { start: number; end: number };

export function overlaps(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end;
}

export function length(s: Span): number {
  return Math.max(0, s.end - s.start);
}

/**
 * What is left of `window` once every span in `busy` is taken out.
 *
 * This is the whole basis of the planner: at every stage it holds a list of
 * free intervals and hands pieces of them out. Anything shorter than `minGap`
 * is dropped, because a nine-minute hole between two blocks is not usable time
 * and putting something in it is how a timetable becomes fiction.
 */
export function subtract(window: Span, busy: Span[], minGap = 15): Span[] {
  const blocks = busy
    .filter((b) => overlaps(b, window))
    .map((b) => ({ start: Math.max(b.start, window.start), end: Math.min(b.end, window.end) }))
    .sort((a, b) => a.start - b.start);

  const out: Span[] = [];
  let cursor = window.start;
  for (const b of blocks) {
    if (b.start - cursor >= minGap) out.push({ start: cursor, end: b.start });
    cursor = Math.max(cursor, b.end);
  }
  if (window.end - cursor >= minGap) out.push({ start: cursor, end: window.end });
  return out;
}

/** Merge touching or overlapping spans, so a free list stays tidy. */
export function merge(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else out.push({ ...s });
  }
  return out;
}

export function totalMinutes(spans: Span[]): number {
  return spans.reduce((a, s) => a + length(s), 0);
}

/**
 * The largest free span that is at least `want` long, preferring one near
 * `near` when that is given. Returns null when nothing fits.
 */
export function findSpan(free: Span[], want: number, near?: number): Span | null {
  const fits = free.filter((s) => length(s) >= want);
  if (!fits.length) return null;
  if (near == null) return fits.reduce((m, s) => (length(s) > length(m) ? s : m));
  return fits.reduce((best, s) => {
    const d = (x: Span) => (near < x.start ? x.start - near : near > x.end ? near - x.end : 0);
    return d(s) < d(best) ? s : best;
  });
}

export function fmtRange(start: number, end: number): string {
  return `${toHHMM(start)}–${toHHMM(end)}`;
}

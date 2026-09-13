import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { eventsBetween, nextEvents, getCommitments } from '@/lib/db';
import { toIso, fmt, fmtLong, addDays, mondayOf, dow, daysBetween } from '@/lib/plan';
import { saveEventAction, deleteEventAction } from '../actions';
import Nav from '../_components/Nav';

export const dynamic = 'force-dynamic';

/**
 * The calendar, and the source of truth.
 *
 * Everything with a date lives here — races, gates sessions, meetings,
 * deadlines, travel, holidays — because the planner reads this table and
 * nothing else. An event that exists only in your head cannot protect a
 * Friday evening.
 */

const KINDS = [
  'race', 'ski', 'gym', 'golf', 'work', 'meeting', 'deadline',
  'travel', 'social', 'appointment', 'holiday', 'admin', 'event',
];

const KIND_COLOUR: Record<string, string> = {
  race: 'var(--rust)', ski: 'var(--rust)', gym: 'var(--str)', golf: 'var(--run)',
  work: 'var(--accent)', meeting: 'var(--accent)', deadline: 'var(--rust)',
  travel: 'var(--faint)', social: 'var(--go)', appointment: 'var(--other)',
  holiday: 'var(--go)', admin: 'var(--other)', event: 'var(--other)',
};

export default async function Calendar({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; v?: string }>;
}) {
  if (!(await currentUser())) redirect('/login');
  const params = await searchParams;
  const today = toIso(new Date());
  const focus = params.d ?? today;
  const view = params.v ?? 'agenda';

  const monthStart = `${focus.slice(0, 7)}-01`;
  const monthEnd = addDays(`${nextMonth(focus)}-01`, -1);
  const gridStart = mondayOf(monthStart);
  const gridEnd = addDays(gridStart, 41);

  const [monthEvents, upcoming, commitments] = await Promise.all([
    eventsBetween(gridStart, gridEnd),
    nextEvents(today, 20),
    getCommitments(),
  ]);

  const onDay = (iso: string) =>
    monthEvents.filter((e) => iso >= e.day && iso <= (e.end_day ?? e.day));

  return (
    <div className="wrap">
      <header className="mast">
        <div>
          <div className="greet">Everything with a date on it</div>
          <h1>Calendar</h1>
        </div>
      </header>

      <div className="subtabs">
        <Link href={`/calendar?v=agenda&d=${focus}`} className={view === 'agenda' ? 'on' : ''}>Agenda</Link>
        <Link href={`/calendar?v=month&d=${focus}`} className={view === 'month' ? 'on' : ''}>Month</Link>
        <Link href={`/calendar?v=week&d=${focus}`} className={view === 'week' ? 'on' : ''}>Week</Link>
        <Link href={`/calendar?v=add&d=${focus}`} className={view === 'add' ? 'on' : ''}>Add</Link>
      </div>

      {/* ------------------------------------------------------------ month */}
      {view === 'month' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <Link href={`/calendar?v=month&d=${addDays(monthStart, -1)}`} className="btn ghost sm">‹</Link>
            <h2 style={{ flex: 1, textAlign: 'center' }}>
              {new Date(monthStart + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </h2>
            <Link href={`/calendar?v=month&d=${addDays(monthEnd, 1)}`} className="btn ghost sm">›</Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <div key={i} className="xs center" style={{ paddingBottom: 4 }}>{d}</div>
            ))}
            {Array.from({ length: 42 }, (_, n) => {
              const iso = addDays(gridStart, n);
              const inMonth = iso.slice(0, 7) === focus.slice(0, 7);
              const evs = onDay(iso);
              const isToday = iso === today;
              return (
                <Link
                  key={iso}
                  href={`/calendar?v=agenda&d=${iso}`}
                  style={{
                    aspectRatio: '1', borderRadius: 10, textDecoration: 'none',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: 3,
                    background: isToday ? 'var(--accent)' : inMonth ? 'var(--surface-2)' : 'transparent',
                    color: isToday ? '#fff' : inMonth ? 'var(--ink)' : 'var(--faint)',
                    fontSize: 13, fontWeight: isToday ? 700 : 500,
                  }}
                >
                  {Number(iso.slice(8))}
                  <span style={{ display: 'flex', gap: 2, height: 4 }}>
                    {evs.slice(0, 3).map((e, i) => (
                      <i key={i} style={{
                        width: 4, height: 4, borderRadius: 999,
                        background: isToday ? '#fff' : KIND_COLOUR[e.kind] ?? 'var(--muted)',
                      }} />
                    ))}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- week */}
      {view === 'week' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <Link href={`/calendar?v=week&d=${addDays(mondayOf(focus), -7)}`} className="btn ghost sm">‹</Link>
            <h2 style={{ flex: 1, textAlign: 'center', fontSize: 15 }}>
              {fmt(mondayOf(focus))} – {fmt(addDays(mondayOf(focus), 6))}
            </h2>
            <Link href={`/calendar?v=week&d=${addDays(mondayOf(focus), 7)}`} className="btn ghost sm">›</Link>
          </div>
          {Array.from({ length: 7 }, (_, n) => {
            const iso = addDays(mondayOf(focus), n);
            const evs = onDay(iso);
            const recur = commitments.filter((c) => c.weekday === dow(iso));
            return (
              <div key={iso} style={{ padding: '11px 0', borderBottom: '1px solid var(--rule-2)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <b style={{ fontSize: 14, color: iso === today ? 'var(--accent)' : undefined }}>{fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' })}</b>
                  {!evs.length && !recur.length && <span className="xs" style={{ marginLeft: 'auto' }}>Clear</span>}
                </div>
                {[...recur.map((c) => ({ title: c.title, at: c.start_at, kind: c.kind, recurring: true })),
                  ...evs.map((e) => ({ title: e.title, at: e.start_at, kind: e.kind, recurring: false }))]
                  .map((x, i) => (
                    <div key={i} className="xs" style={{ marginTop: 5, display: 'flex', gap: 8 }}>
                      <i style={{ width: 3, borderRadius: 2, background: KIND_COLOUR[x.kind] ?? 'var(--muted)', flexShrink: 0 }} />
                      <span>{x.at ? `${x.at} · ` : ''}{x.title}{x.recurring ? ' (every week)' : ''}</span>
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ----------------------------------------------------------- agenda */}
      {view === 'agenda' && (
        <>
          {upcoming.length === 0 ? (
            <div className="card empty">
              <div className="ic">📅</div>
              <b>Nothing in the diary</b>
              <p>
                Races, gates sessions, meetings and deadlines all live here, and the planner
                builds every day around them. Start with the next thing you already know about.
              </p>
              <Link href="/calendar?v=add" className="btn">Add an event</Link>
            </div>
          ) : (
            upcoming.map((e) => {
              const away = daysBetween(today, e.day);
              return (
                <div key={e.id} className="sesh">
                  <div className="sesh-h">
                    <span className="slot">{fmt(e.day)}</span>
                    <span className="disc" style={{ background: KIND_COLOUR[e.kind] ?? 'var(--other)' }}>{e.kind}</span>
                    <b>{e.title}</b>
                    <span className="mins">
                      {away === 0 ? 'Today' : away === 1 ? 'Tomorrow' : `${away} days`}
                    </span>
                  </div>
                  <div className="sesh-b">
                    {e.start_at && <div>{e.start_at}{e.end_at ? `–${e.end_at}` : ''}{e.venue ? ` · ${e.venue}` : ''}</div>}
                    {!e.start_at && e.venue && <div>{e.venue}</div>}
                    {e.notes && <div className="why">{e.notes}</div>}
                    {e.travel_min > 0 && <div className="xs" style={{ marginTop: 4 }}>{e.travel_min} min travel each way, protected in the plan.</div>}
                    <div style={{ display: 'flex', gap: 6, marginTop: 9 }}>
                      <Link href={`/calendar?v=add&d=${e.day}&edit=${e.id}`} className="btn ghost sm">Edit</Link>
                      <form action={deleteEventAction}>
                        <input type="hidden" name="id" value={e.id} />
                        <button className="ghost sm" type="submit">Delete</button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </>
      )}

      {/* -------------------------------------------------------------- add */}
      {view === 'add' && (
        <form action={saveEventAction} className="card">
          <h2>New event</h2>
          <p className="desc">
            Anything here is protected: the planner will not schedule over it, and it will
            arrange the rest of the day around it rather than pretending it is not happening.
          </p>
          <label className="f">
            <span className="lab">What</span>
            <input type="text" name="title" required placeholder="Llandudno Club National" />
          </label>
          <div className="grid2">
            <label className="f">
              <span className="lab">Date</span>
              <input type="date" name="day" required defaultValue={focus} />
            </label>
            <label className="f">
              <span className="lab">Ends (if more than a day)</span>
              <input type="date" name="end_day" />
            </label>
          </div>
          <div className="grid2">
            <label className="f">
              <span className="lab">Starts</span>
              <input type="time" name="start_at" />
            </label>
            <label className="f">
              <span className="lab">Ends</span>
              <input type="time" name="end_at" />
            </label>
          </div>
          <div className="grid2">
            <label className="f">
              <span className="lab">Kind</span>
              <select name="kind" defaultValue="event">
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            <label className="f">
              <span className="lab">Travel each way (min)</span>
              <input type="number" name="travel_min" inputMode="numeric" placeholder="0" />
            </label>
          </div>
          <label className="f">
            <span className="lab">Where</span>
            <input type="text" name="venue" />
          </label>
          <label className="f">
            <span className="lab">Notes</span>
            <input type="text" name="notes" />
          </label>
          <button className="wide" type="submit">Add it</button>
        </form>
      )}

      {view === 'agenda' && commitments.length > 0 && (
        <div className="card">
          <h2>Every week</h2>
          <p className="desc">
            Recurring commitments the planner protects on the same day every week. Edit them
            under More.
          </p>
          {commitments.map((c) => (
            <div key={c.id} className="xs" style={{ padding: '8px 0', borderBottom: '1px solid var(--rule-2)' }}>
              <b style={{ fontSize: 13.5, color: 'var(--ink)' }}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][c.weekday - 1]} {c.start_at}
              </b>
              {' — '}{c.title} ({c.minutes} min{c.travel_min ? ` + ${c.travel_min} min travel each way` : ''})
            </div>
          ))}
        </div>
      )}

      <p className="xs center">Showing from {fmtLong(today)}.</p>
      <Nav active="/calendar" />
    </div>
  );
}

function nextMonth(iso: string): string {
  const [y, m] = iso.slice(0, 7).split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { loadToday } from '@/lib/today';
import { fmtLong } from '@/lib/plan';
import { toHHMM, hmShort, hm } from '@/lib/clock';
import { setBlockStatusAction, lockBlockAction, replanAction } from './actions';
import Nav from './_components/Nav';
import { Ring, Bar } from './_components/Ring';

export const dynamic = 'force-dynamic';

const GREETING: Record<string, string> = {
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
};

/**
 * The Today screen.
 *
 * The whole application exists to answer one question the moment it opens —
 * what should I be doing right now, and why — so that answer is above
 * everything else, in the largest type on the page, before any dashboard.
 *
 * What sits under it changes with the hour. In the morning the useful things
 * are sleep, readiness and the shape of the day. By the afternoon it is what is
 * happening now and what comes next. In the evening it is what actually got
 * done, what it did for the long-term goals, and what tomorrow looks like.
 * Showing all of that at once would be a dashboard, and dashboards get skimmed.
 */
export default async function Today({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  if (!(await currentUser())) redirect('/login');
  const params = await searchParams;
  const t = await loadToday(params.day);

  // The morning check-in gates the app once a day. Everything below depends on
  // it, and guessing at readiness would poison the plan and the score together.
  if (t.needsCheckIn) redirect('/checkin');

  const { plan, score, readiness } = t;
  const morning = t.partOfDay === 'morning';
  const evening = t.partOfDay === 'evening';

  const work = plan.blocks.filter((b) => b.kind === 'work' || b.kind === 'own');
  const done = plan.blocks.filter((b) => b.status === 'done').length;
  const actionable = plan.blocks.filter((b) => b.kind !== 'free' && b.kind !== 'sleep' && b.kind !== 'meal');

  return (
    <div className="wrap">
      <header className="mast">
        <div>
          <div className="greet">{GREETING[t.partOfDay]}</div>
          <h1>{fmtLong(t.day)}</h1>
        </div>
      </header>

      {/* ------------------------------------------------- what now, and why */}
      {t.now_ && !evening && (
        <div className="hero">
          <div className="lab">Now</div>
          <div className="big" style={{ fontSize: 30, marginTop: 8, marginBottom: 6 }}>
            {t.now_.title}
          </div>
          <p style={{ marginBottom: 10 }}>{t.now_.when}</p>
          <p style={{ color: 'var(--dark-ink)', opacity: 0.9 }}>{t.now_.why}</p>
          {t.now_.thenTitle && (
            <>
              <hr style={{ margin: '16px 0 12px' }} />
              <p>Then {t.now_.thenAt} — {t.now_.thenTitle}</p>
            </>
          )}
        </div>
      )}

      {/* ------------------------------------------------------- today score */}
      <div className={evening ? 'hero' : 'card'}>
        <div className="lab">Today Score</div>
        {score.score == null ? (
          <>
            <div className="big" style={{ fontSize: 40 }}>—</div>
            <p style={{ marginTop: 4 }}>{score.detail}</p>
          </>
        ) : (
          <>
            <div className="big">
              {score.score}<small> / 100</small>
            </div>
            <p>
              {score.headline}
              {t.scoreTrend.avg != null && ` · 7-day average ${t.scoreTrend.avg}`}
              {t.scoreTrend.delta != null && t.scoreTrend.delta !== 0 &&
                ` (${t.scoreTrend.delta > 0 ? '+' : ''}${t.scoreTrend.delta})`}
            </p>
            <div className="row-stats">
              <div>
                <div className="v">{t.sleepH != null ? `${t.sleepH.toFixed(1)}h` : '—'}</div>
                <div className="n">Sleep</div>
              </div>
              <div>
                <div className="v">{readiness ? readiness.score : '—'}</div>
                <div className="n">Readiness</div>
              </div>
              <div>
                <div className="v">{hmShort(plan.workMinutes)}</div>
                <div className="n">Workload</div>
              </div>
              <div>
                <div className="v">{hmShort(plan.freeMinutes)}</div>
                <div className="n">Free</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ------------------------------------------------ readiness, morning */}
      {morning && readiness && (
        <div className={`verdict ${readiness.band}`}>
          <h2>{readiness.headline}</h2>
          <p>{readiness.action}</p>
          {readiness.drivers.length > 0 && (
            <p className="xs" style={{ marginTop: 8 }}>{readiness.drivers[0]}</p>
          )}
        </div>
      )}

      {t.knee.band !== 'green' && (
        <div className={`verdict ${t.knee.band}`}>
          <h2>{t.knee.line}</h2>
          {t.knee.detail && <p>{t.knee.detail}</p>}
        </div>
      )}

      {/* ---------------------------------------------------- the priority */}
      {t.priority && !evening && (
        <div className="card">
          <div className="lab">Biggest priority</div>
          <h2 style={{ fontSize: 21, margin: '6px 0 6px' }}>{t.priority.title}</h2>
          <p className="small muted" style={{ marginBottom: 0 }}>{t.priority.detail}</p>
        </div>
      )}

      {/* ----------------------------------------------------- the timetable */}
      <div style={{ display: 'flex', alignItems: 'baseline', padding: '4px 4px 10px' }}>
        <h2>The day</h2>
        <span className="xs" style={{ marginLeft: 'auto' }}>
          {done} of {actionable.length} done
        </span>
      </div>

      <div className="tl">
        {plan.blocks
          .filter((b) => b.kind !== 'sleep' || b.title === 'Lights out')
          .map((b, i) => {
            const isNow = t.now_ != null && b.start <= t.now && b.end > t.now;
            const stored = t.blocks.find((x) => x.start === b.start && x.title === b.title);
            return (
              <div
                key={`${b.start}-${b.title}-${i}`}
                className={`tl-row ${isNow ? 'now' : ''} ${b.kind === 'free' ? 'is-free' : ''} ${b.status === 'done' ? 'is-done' : ''}`}
              >
                <span className="t">{toHHMM(b.start)}</span>
                <span className={`bar k-${b.kind}`} />
                <span className="body">
                  <b>{b.title}</b>
                  {b.why && b.kind !== 'free' && <span className="d">{b.why}</span>}
                  {b.kind === 'free' && <span className="d">{hm(b.end - b.start)} — yours</span>}
                  {stored && b.kind !== 'free' && b.kind !== 'sleep' && (
                    <span style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <form action={setBlockStatusAction}>
                        <input type="hidden" name="id" value={stored.id} />
                        <input type="hidden" name="day" value={t.day} />
                        <input type="hidden" name="status" value={b.status === 'done' ? 'planned' : 'done'} />
                        <button className="ghost sm" type="submit">
                          {b.status === 'done' ? 'Undo' : 'Done'}
                        </button>
                      </form>
                      <form action={setBlockStatusAction}>
                        <input type="hidden" name="id" value={stored.id} />
                        <input type="hidden" name="day" value={t.day} />
                        <input type="hidden" name="status" value="skipped" />
                        <button className="ghost sm" type="submit">Skip</button>
                      </form>
                      <form action={lockBlockAction}>
                        <input type="hidden" name="id" value={stored.id} />
                        <input type="hidden" name="day" value={t.day} />
                        <input type="hidden" name="locked" value={stored.locked ? '0' : '1'} />
                        <button className="ghost sm" type="submit" title="A locked block is never moved by replanning">
                          {stored.locked ? 'Unlock' : 'Lock'}
                        </button>
                      </form>
                    </span>
                  )}
                </span>
                <span className="dur">{hmShort(b.end - b.start)}</span>
              </div>
            );
          })}
      </div>

      <form action={replanAction} style={{ marginBottom: 14 }}>
        <input type="hidden" name="day" value={t.day} />
        <button className="ghost wide" type="submit">Replan the rest of the day</button>
      </form>

      {plan.notes.map((nte, i) => (
        <div key={i} className="note neutral">{nte}</div>
      ))}

      {plan.unplaced.length > 0 && (
        <div className="note warn">
          <b>Would not fit today.</b>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {plan.unplaced.map((u, i) => (
              <li key={i} style={{ marginBottom: 5 }}>{u.job.title} — {u.why}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ------------------------------------------------- work, at a glance */}
      {work.length > 0 && !evening && (
        <div className="card">
          <h2>Work today</h2>
          <p className="desc">
            {hm(plan.workMinutes)} scheduled across {work.length} block{work.length === 1 ? '' : 's'}.
            {plan.overCap > 0 && ` That is ${hm(plan.overCap)} past your line — a deadline forced it.`}
          </p>
          <Link href="/work" className="btn ghost wide">Open the work list</Link>
        </div>
      )}

      {/* ------------------------------------------- goals: the long game */}
      {t.goals.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 12 }}>
            <h2>The long game</h2>
            <Link href="/goals" className="xs" style={{ marginLeft: 'auto' }}>All goals ›</Link>
          </div>
          {t.goals.slice(0, 4).map((g) => (
            <div key={g.goal.id} className="goal-row">
              <div className="top">
                <b>{g.goal.title}</b>
                <span className="pc">{g.pct == null ? '—' : `${g.pct}%`}</span>
              </div>
              <Bar pct={g.pct} area={g.goal.area} />
              <div className="xs" style={{ marginTop: 6 }}>
                {g.measured ? `${g.currentLabel} of ${g.targetLabel}` : 'Not measured yet'}
                {g.next && ` · next: ${g.next.label}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------- evening: the score */}
      {evening && score.score != null && (
        <div className="card">
          <h2>How today scored</h2>
          <p className="desc">{score.detail}</p>
          {score.parts.map((p) => (
            <div key={p.key} className="bar-row">
              <span className="nm">{p.label}</span>
              <span className="bar-track">
                <i style={{ width: `${p.value == null ? 0 : Math.round(p.value * 100)}%` }} />
              </span>
              <span className="vv">{p.value == null ? 'no data' : `${Math.round(p.value * 100)}%`}</span>
            </div>
          ))}
          <div className="note neutral" style={{ marginTop: 14, marginBottom: 0 }}>
            {score.parts.map((p) => p.note).filter(Boolean).slice(0, 2).map((nte, i) => (
              <p key={i} style={{ margin: i ? '8px 0 0' : 0 }}>{nte}</p>
            ))}
          </div>
        </div>
      )}

      {evening && (
        <div className="card">
          <h2>Tomorrow</h2>
          <p className="desc" style={{ marginBottom: 12 }}>
            Worth thirty seconds tonight. Anything you move now is a decision; anything you move
            at eight tomorrow morning is a scramble.
          </p>
          <Link href={`/?day=${nextDay(t.day)}`} className="btn ghost wide">Look at tomorrow</Link>
        </div>
      )}

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Ring
          pct={t.ctx.daysToChamps > 0 ? Math.round(100 - (t.ctx.daysToChamps / 700) * 100) : 100}
          value={`${t.ctx.daysToChamps}`}
          label="days"
          size={72}
          colour="var(--rust)"
        />
        <div>
          <b style={{ fontSize: 15 }}>British Championships</b>
          <div className="xs" style={{ marginTop: 3 }}>
            {t.ctx.block.name} · block {t.ctx.block.n} of 9
            {t.ctx.nextEvent && (
              t.ctx.daysToNext != null && t.ctx.daysToNext <= 0
                ? ` · ${t.ctx.nextEvent.name} is on now`
                : ` · ${t.ctx.nextEvent.name} in ${t.ctx.daysToNext} day${t.ctx.daysToNext === 1 ? '' : 's'}`
            )}
          </div>
        </div>
      </div>

      <p className="xs center" style={{ marginTop: 4 }}>
        <Link href="/checkin">Edit this morning&rsquo;s check-in</Link>
      </p>

      <Nav active="/" />
    </div>
  );
}

function nextDay(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

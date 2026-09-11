import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import {
  getSettings, getReadiness, recentReadiness, recentKnee, getKnee,
  allJobs, getSlots,
} from '@/lib/db';
import { brief } from '@/lib/coach';
import { toIso, fmtLong, fmt } from '@/lib/plan';
import { targets } from '@/lib/fuel';
import { KNEE10 } from '@/lib/knee';
import { fmtMinutes } from '@/lib/work';
import { LEFT_FIRST_RULE } from '@/lib/gym';
import Nav from './_components/Nav';
import Mast from './_components/Mast';
import CheckIn from './_components/CheckIn';

export const dynamic = 'force-dynamic';

export default async function Today() {
  if (!(await currentUser())) redirect('/login');

  const day = toIso(new Date());
  const [settings, today, history, kneeLogs, kneeToday, jobs, slots] = await Promise.all([
    getSettings(), getReadiness(day), recentReadiness(day, 30), recentKnee(day, 40),
    getKnee(day), allJobs(), getSlots(),
  ]);

  const b = brief(day, { today, history, kneeLogs, jobs, slots });
  const { ctx } = b;
  const fuel = targets(settings.weight_kg, day);
  const weightGap = Math.round((settings.weight_kg - ctx.targetWeight) * 10) / 10;
  const sesh = b.session;

  return (
    <div className="wrap">
      <Mast ctx={ctx} title={fmtLong(day)} />

      {/* --------------------------------------------------- the verdict */}
      <div className={`verdict ${b.band}`}>
        <h2>{b.headline}</h2>
        <p>{b.sub}</p>
        {b.readiness && (
          <p className="xs" style={{ marginTop: 8 }}>
            Readiness {b.readiness.score} · {ctx.block.name} · {ctx.plan.headline}
          </p>
        )}
      </div>

      {b.readiness?.drivers.length ? (
        <div className="note neutral">
          {b.readiness.drivers.map((d, i) => (
            <p key={i} style={{ margin: i ? '6px 0 0' : 0 }}>{d}</p>
          ))}
        </div>
      ) : null}

      {/* --------------------------------------------------------- work */}
      <div className="card">
        <h2>What work to do</h2>
        <p className="desc">{b.next.line}</p>

        {b.next.alsoChase && (
          <div className="note" style={{ marginBottom: 12 }}>
            <b>Chase first, it costs two minutes.</b>{' '}
            {b.next.alsoChase.job.title} has been sitting on {b.next.alsoChase.job.waiting_on} for{' '}
            {b.next.alsoChase.waitingDays} day{b.next.alsoChase.waitingDays === 1 ? '' : 's'}. Nothing moves until they move.
          </div>
        )}

        {b.q.doNow.slice(0, 4).map((s, i) => (
          <div key={s.job.id} className="sesh">
            <div className="sesh-h">
              <span className="slot">{i + 1}</span>
              <span className={`disc d-${s.job.kind}`}>{s.job.kind}</span>
              <b>{s.job.title}</b>
              {s.job.client && <span className="xs">{s.job.client}</span>}
              {s.atRisk && <span className="chip red">Will not fit</span>}
              {s.job.dread && <span className="chip amber">Avoided</span>}
              <span className="mins">{fmtMinutes(s.remaining)}</span>
            </div>
            <div className="sesh-b">
              {s.reason}
              {s.job.due && (
                <div className="xs" style={{ marginTop: 4 }}>
                  Due {fmt(s.job.due)}
                  {s.capacityToDue !== null && ` · ${fmtMinutes(s.capacityToDue)} of slot before then`}
                </div>
              )}
            </div>
          </div>
        ))}

        <div className={`note ${b.work.band === 'green' ? 'neutral' : ''}`} style={{ marginTop: 12, marginBottom: 0 }}>
          <b>{b.work.headline}.</b> {b.work.detail}
        </div>

        <p style={{ marginTop: 12, marginBottom: 0 }}>
          <Link href="/work" className="btn ghost wide">Open the work list</Link>
        </p>
      </div>

      {/* ------------------------------------------------------ training */}
      {sesh ? (
        <div className="card">
          <h2>
            Day {sesh.day.n} — {sesh.replaces ? sesh.replaces.title : sesh.day.title}
          </h2>
          <p className="desc">
            {sesh.day.time} · {sesh.replaces ? '25' : sesh.day.minutes} min ·{' '}
            {sesh.replaces ? 'Race week — no fatigue' : sesh.day.subtitle}
            {!sesh.replaces && <> · compounds at <b>{sesh.compounds}</b></>}
          </p>

          {sesh.notes.map((n, i) => (
            <div key={i} className="note" style={{ marginBottom: 10 }}>{n}</div>
          ))}

          {sesh.day.warmup && (
            <div className="note neutral"><b>Warm-up.</b> {sesh.day.warmup}</div>
          )}

          {sesh.plyo.length === 0 && sesh.day.key === 'lowerB' && b.rung.suspended && (
            <div className="note" style={{ marginBottom: 10 }}>
              <b>No plyometrics today.</b> {b.rung.reason}
            </div>
          )}

          {sesh.plyo.length > 0 && (
            <div className="sesh">
              <div className="sesh-h">
                <span className={`disc d-plyo`}>Plyo</span>
                <b>Rung {b.rung.rung} — {b.rung.spec.name}</b>
                <span className="mins">{ctx.monthsPostOp.toFixed(1)} mo</span>
              </div>
              <div className="sesh-b">
                <ul style={{ margin: '0 0 6px', paddingLeft: 18 }}>
                  {sesh.plyo.map((p) => <li key={p}>{p}</li>)}
                </ul>
                <div className="why">{b.rung.reason}</div>
              </div>
            </div>
          )}

          <div className="scroll">
            <table>
              <thead>
                <tr><th>Exercise</th><th style={{ width: 92 }}>Sets</th></tr>
              </thead>
              <tbody>
                {(sesh.replaces ? sesh.replaces.exercises : sesh.day.exercises.filter((e) => !e.plyo)).map((e) => (
                  <tr key={e.name}>
                    <td className="k">
                      {e.name}
                      {e.left && <span className="chip key" style={{ marginLeft: 6 }}>Left first</span>}
                      {e.note && <div className="xs" style={{ fontWeight: 400, marginTop: 2 }}>{e.note}</div>}
                    </td>
                    <td className="mono">
                      {e.compound && !sesh.replaces ? sesh.compounds.split(',')[0] : e.sets}
                      {e.iso && sesh.isolationScale < 1 && (
                        <div className="xs">−{Math.round((1 - sesh.isolationScale) * 100)}%</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="note" style={{ marginTop: 12, marginBottom: 0 }}>
            <b>The rule.</b> {LEFT_FIRST_RULE}
          </div>

          {!sesh.replaces && sesh.day.tail && <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>{sesh.day.tail}</p>}
        </div>
      ) : (
        <div className="card">
          <h2>No lift today</h2>
          <p className="desc" style={{ marginBottom: 0 }}>{ctx.plan.headline}. That is the plan, not a gap in it.</p>
        </div>
      )}

      {/* ---------------------------------------------------- the day */}
      <div className="card">
        <h2>{ctx.plan.name}</h2>
        <p className="desc">{ctx.plan.headline}</p>
        {ctx.plan.slots.map((s) => (
          <div key={s.time + s.label} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--rule-2)' }}>
            <span className="mono xs" style={{ width: 46, flexShrink: 0, paddingTop: 2 }}>{s.time}</span>
            <span style={{ flex: 1 }}>
              <b style={{ fontSize: 14 }}>{s.label}</b>
              {s.detail && <div className="xs" style={{ marginTop: 2 }}>{s.detail}</div>}
            </span>
          </div>
        ))}
      </div>

      {/* --------------------------------------------------------- knee */}
      <div className="card">
        <h2>The left leg</h2>
        <p className="desc">
          {ctx.monthsPostOp.toFixed(1)} months post-op · Rung {b.rung.rung} — {b.rung.spec.name}
          {b.rung.suspended
            ? ` · block suspended until ${b.rung.demotedUntil}`
            : b.rung.demoted
              ? ` · held down until ${b.rung.demotedUntil}`
              : ''}
        </p>
        <div className={`verdict ${b.knee.band}`} style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 15 }}>{b.knee.line}</h2>
          {b.knee.detail && <p>{b.knee.detail}</p>}
        </div>
        <div className="kpis">
          <div className="kpi">
            <div className="v">{kneeToday?.knee10 ? 'Done' : 'Not yet'}</div>
            <div className="n">Knee 10 — {KNEE10.length} movements, ten minutes, non-negotiable</div>
          </div>
          <div className="kpi acc">
            <div className="v acc">{kneeToday?.swelling === null || kneeToday === null ? '—' : ['Zero', 'Trace', '1+', '2+'][kneeToday.swelling ?? 0]}</div>
            <div className="n">Last swelling grade</div>
          </div>
        </div>
        <Link href="/knee" className="btn ghost wide">Knee page — log it</Link>
      </div>

      {/* --------------------------------------------------------- fuel */}
      <div className="card">
        <h2>Fuel today</h2>
        <p className="desc">
          {fuel.training ? 'Training day' : 'Light day'} at {settings.weight_kg.toFixed(1)} kg · target for today&rsquo;s
          date is {ctx.targetWeight.toFixed(1)} kg
          {weightGap >= 0 ? ` — you are ${weightGap.toFixed(1)} kg ahead` : ` — you are ${Math.abs(weightGap).toFixed(1)} kg behind`}
        </p>
        <div className="kpis" style={{ marginBottom: 0 }}>
          <div className="kpi acc"><div className="v acc">{fuel.kcal.toLocaleString()}</div><div className="n">kcal</div></div>
          <div className="kpi"><div className="v">{fuel.protein} g</div><div className="n">protein</div></div>
          <div className="kpi"><div className="v">{fuel.carbs} g</div><div className="n">carbs</div></div>
          <div className="kpi"><div className="v">{fuel.fat} g</div><div className="n">fat</div></div>
        </div>
      </div>

      {/* ----------------------------------------------------- check-in */}
      <CheckIn day={day} existing={today} />

      <p className="xs" style={{ textAlign: 'center' }}>
        {ctx.block.name} · block {ctx.block.n} of 9 · {ctx.nextEvent ? `${ctx.nextEvent.name} in ${ctx.daysToNext} days` : 'no events scheduled'}
      </p>

      <Nav active="/" />
    </div>
  );
}

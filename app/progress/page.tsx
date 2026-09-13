import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { getSettings, weightSeries, lsiRows, sessionsBetween, workLogBetween, recentReadiness } from '@/lib/db';
import { context } from '@/lib/coach';
import { toIso, fmt, addDays, targetWeight, BLOCKS, RACES, daysBetween } from '@/lib/plan';
import { LSI_TESTS, lsiTarget } from '@/lib/knee';
import { fmtMinutes } from '@/lib/work';
import Nav from '../_components/Nav';
import Mast from '../_components/Mast';

export const dynamic = 'force-dynamic';

export default async function ProgressPage() {
  if (!(await currentUser())) redirect('/login');

  const day = toIso(new Date());
  const ctx = context(day);
  const from = addDays(day, -83);

  const [settings, weights, lsi, sessions, work, readiness] = await Promise.all([
    getSettings(), weightSeries(200), lsiRows(60), sessionsBetween(from, day),
    workLogBetween(from, day), recentReadiness(day, 30),
  ]);

  const tgt = targetWeight(day);
  const gap = Math.round((settings.weight_kg - tgt) * 10) / 10;

  /* weight — a sparkline drawn as an SVG polyline, no library */
  const pts = weights.slice(-60);
  const ws = pts.map((p) => p.weight_kg);
  const lo = Math.min(...ws, tgt) - 0.6;
  const hi = Math.max(...ws, tgt) + 0.6;
  const W = 320, H = 90;
  const xy = (i: number, v: number) => [
    pts.length > 1 ? (i / (pts.length - 1)) * W : 0,
    H - ((v - lo) / Math.max(hi - lo, 0.1)) * H,
  ];
  const line = pts.map((p, i) => xy(i, p.weight_kg).map((n) => n.toFixed(1)).join(',')).join(' ');
  const tline = pts.length > 1
    ? pts.map((p, i) => xy(i, targetWeight(p.day)).map((n) => n.toFixed(1)).join(',')).join(' ')
    : '';

  /* training touches per week over the last twelve weeks */
  const byWeek = new Map<string, number>();
  for (const s of sessions) {
    const k = addDays(s.day, 1 - ((new Date(s.day + 'T12:00:00').getDay() + 6) % 7 + 1));
    byWeek.set(k, (byWeek.get(k) ?? 0) + 1);
  }
  const weeks = [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
  const maxTouches = Math.max(1, ...weeks.map((w) => w[1]));

  const workMins = work.reduce((a, l) => a + l.minutes, 0);
  const latest = new Map<string, (typeof lsi)[number]>();
  for (const r of lsi) if (!latest.has(r.test)) latest.set(r.test, r);
  const target = lsiTarget(day);

  const sleepAvg = readiness.filter((r) => r.sleep_h !== null).slice(0, 14);
  const sleepMean = sleepAvg.length
    ? sleepAvg.reduce((a, r) => a + (r.sleep_h ?? 0), 0) / sleepAvg.length
    : null;

  return (
    <div className="wrap">
      <Mast ctx={ctx} title="Progress" />

      <div className="kpis">
        <div className="kpi acc">
          <div className="v acc">{settings.weight_kg.toFixed(1)} kg</div>
          <div className="n">Target today {tgt.toFixed(1)} kg — {gap >= 0 ? `${gap.toFixed(1)} ahead` : `${Math.abs(gap).toFixed(1)} behind`}</div>
        </div>
        <div className="kpi"><div className="v">{sleepMean ? `${sleepMean.toFixed(1)} h` : '—'}</div><div className="n">Sleep, last 14 logged</div></div>
        <div className="kpi"><div className="v">{sessions.length}</div><div className="n">Sessions, last 12 weeks</div></div>
        <div className="kpi"><div className="v">{fmtMinutes(workMins)}</div><div className="n">Own-business time, 12 weeks</div></div>
      </div>

      {/* ------------------------------------------------------- weight */}
      <div className="card">
        <h2>The ten kilos</h2>
        <p className="desc">
          70 → 80 kg across 47 weeks, about 0.21 kg a week. The dashed line is where the plan says you should be. A stall
          around month four is almost always a 76 kg man still eating like a 70 kg one — recalculate every 3 kg.
        </p>
        {pts.length > 1 ? (
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', overflow: 'visible' }} role="img" aria-label="Bodyweight against plan">
            <polyline points={tline} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4 3" />
            <polyline points={line} fill="none" stroke="var(--rust)" strokeWidth="2" />
          </svg>
        ) : (
          <p className="muted small">Two weigh-ins and this draws itself. Saturday, 08:00, fasted, same scales.</p>
        )}
        {pts.length > 1 && (
          <p className="xs" style={{ marginTop: 6, marginBottom: 0 }}>
            {fmt(pts[0].day)} → {fmt(pts[pts.length - 1].day)} · {pts[0].weight_kg.toFixed(1)} → {pts[pts.length - 1].weight_kg.toFixed(1)} kg
          </p>
        )}
      </div>

      {/* ---------------------------------------------------------- LSI */}
      <div className="card">
        <h2>Symmetry</h2>
        <p className="desc">
          The thing that actually predicts whether you attack a course or manage it. Confidence follows the number, not
          the other way round. Target for today: {target}%.
        </p>
        {LSI_TESTS.map((t) => {
          const r = latest.get(t.key);
          const pct = r ? Math.min(100, r.lsi) : 0;
          return (
            <div className="bar-row" key={t.key}>
              <span className="nm" style={{ width: 116 }}>{t.name.replace('Single-leg ', '').replace('Triple ', '')}</span>
              <span className="bar-track"><i style={{ width: `${pct}%`, background: r && r.lsi >= target ? 'var(--go)' : 'var(--rust)' }} /></span>
              <span className="vv">{r ? `${r.lsi.toFixed(1)}%` : '—'}</span>
            </div>
          );
        })}
        <p className="xs" style={{ marginTop: 10, marginBottom: 0 }}>
          If the crossover hop is still under 85% in January, that is a rotational-control gap and it needs a specific
          fix, not more of the same.
        </p>
      </div>

      {/* ---------------------------------------------------- touches */}
      {weeks.length > 0 && (
        <div className="card">
          <h2>Training touches a week</h2>
          <p className="desc">
            Five lifts, one gates session and two rounds is eight. Consistently above that on a rebuilt leg is how you
            find the ceiling the hard way.
          </p>
          {weeks.map(([w, n]) => (
            <div className="bar-row" key={w}>
              <span className="nm mono xs" style={{ width: 64 }}>{fmt(w)}</span>
              <span className="bar-track"><i style={{ width: `${(n / maxTouches) * 100}%`, background: n > 9 ? 'var(--rust)' : 'var(--muted)' }} /></span>
              <span className="vv">{n}</span>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------- blocks */}
      <div className="card">
        <h2>Where you are</h2>
        <div className="scroll">
          <table>
            <thead><tr><th>Block</th><th>Dates</th><th>Weeks</th><th>Target</th></tr></thead>
            <tbody>
              {BLOCKS.map((b) => (
                <tr key={b.n} style={b.n === ctx.block.n ? { background: 'var(--rust-soft)' } : undefined}>
                  <td className="k">{b.n} — {b.short}</td>
                  <td className="xs mono">{fmt(b.from)} – {fmt(b.to)}</td>
                  <td>{b.weeks}</td>
                  <td className="xs">{b.targets[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* -------------------------------------------------------- races */}
      <div className="card">
        <h2>The calendar</h2>
        <div className="scroll">
          <table>
            <thead><tr><th>Date</th><th>Event</th><th>Aim</th><th style={{ textAlign: 'right' }}>Away</th></tr></thead>
            <tbody>
              {RACES.map((r) => {
                const d = daysBetween(day, r.day);
                return (
                  <tr key={r.name} style={r.target ? { background: 'var(--rust-soft)' } : undefined}>
                    <td className="mono xs">{fmt(r.day)}{r.end !== r.day && `–${fmt(r.end)}`}</td>
                    <td className="k">{r.name}{r.test && <span className="chip plain" style={{ marginLeft: 6 }}>Test</span>}<div className="xs" style={{ fontWeight: 400 }}>{r.venue}</div></td>
                    <td className="xs">{r.aim}</td>
                    <td style={{ textAlign: 'right' }}>{d < 0 ? <span className="muted">done</span> : `${d}d`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Nav active="/reference" />
    </div>
  );
}

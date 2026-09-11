import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { recentKnee, getKnee, lsiRows } from '@/lib/db';
import { context } from '@/lib/coach';
import { toIso, fmt, monthsPostOp, SURGERY } from '@/lib/plan';
import {
  LADDER, KNEE10, SWELLING, RED_FLAGS, LSI_TESTS, rungFor, rungByAge,
  kneeVerdict, lsiTarget, rungBlocks,
} from '@/lib/knee';
import { saveKneeAction, saveLsiAction } from '../actions';
import Nav from '../_components/Nav';
import Mast from '../_components/Mast';

export const dynamic = 'force-dynamic';

export default async function KneePage() {
  if (!(await currentUser())) redirect('/login');

  const day = toIso(new Date());
  const ctx = context(day);
  const [logs, todayLog, lsi] = await Promise.all([recentKnee(day, 60), getKnee(day), lsiRows(40)]);
  const rung = rungFor(day, logs);
  const v = kneeVerdict(day, logs);
  const months = monthsPostOp(day);
  const target = lsiTarget(day);

  const latestByTest = new Map<string, (typeof lsi)[number]>();
  for (const r of lsi) if (!latestByTest.has(r.test)) latestByTest.set(r.test, r);

  return (
    <div className="wrap">
      <Mast ctx={ctx} title="The left leg" />

      <div className={`verdict ${v.band}`}>
        <h2>{v.line}</h2>
        {v.detail && <p>{v.detail}</p>}
      </div>

      <div className="kpis">
        <div className="kpi acc"><div className="v acc">{months.toFixed(1)}</div><div className="n">Months post-op — surgery {fmt(SURGERY, { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
        <div className="kpi"><div className="v">Rung {rung.rung}</div><div className="n">{rung.spec.name}{rung.suspended ? ' — suspended' : rung.demoted ? ' — held down' : ''}</div></div>
        <div className="kpi"><div className="v">{target}%</div><div className="n">LSI target for today</div></div>
        <div className="kpi"><div className="v">22.6</div><div className="n">Months post-op at Champs</div></div>
      </div>

      <div className="note neutral">
        <b>Why the rung is where it is.</b> {rung.reason} The block would allow Rung {ctx.block.rung}; the graft&rsquo;s age
        allows Rung {rungByAge(day)}. The app always takes the lower of the two.
      </div>

      {/* ------------------------------------------------------ log today */}
      <form action={saveKneeAction} className="card">
        <h2>Log the knee</h2>
        <p className="desc">
          Two minutes on a Thursday before you swim. Without it, the monitoring does not exist — and this is the half of
          the job that cannot be done from a screen.
        </p>
        <input type="hidden" name="day" value={day} />

        <label className="f">
          <span className="lab">Swelling — the stroke test</span>
          <select name="swelling" defaultValue={String(todayLog?.swelling ?? 0)}>
            {SWELLING.map((s) => <option key={s.grade} value={s.grade}>{s.label} — {s.sees}</option>)}
          </select>
        </label>

        <div className="grid2">
          <label className="f">
            <span className="lab">Worst pain today (0–10)</span>
            <input type="number" name="pain" min={0} max={10} defaultValue={todayLog?.pain ?? 0} inputMode="numeric" />
          </label>
          <label className="f">
            <span className="lab">Full extension &amp; flexion</span>
            <select name="flexion_ok" defaultValue={todayLog?.flexion_ok === false ? '' : 'on'}>
              <option value="on">Yes — full range</option>
              <option value="">No — something is blocking it</option>
            </select>
          </label>
        </div>

        <div className="row" style={{ marginBottom: 14 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }} className="small">
            <input type="checkbox" name="knee10" defaultChecked={todayLog?.knee10 ?? false} style={{ width: 'auto' }} />
            Knee 10 done
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }} className="small">
            <input type="checkbox" name="plyo_done" defaultChecked={todayLog?.plyo_done ?? false} style={{ width: 'auto' }} />
            Plyometrics today
          </label>
        </div>

        <label className="f"><span className="lab">Notes</span><textarea name="notes" defaultValue={todayLog?.notes ?? ''} /></label>
        <button className="wide" type="submit">Save</button>
      </form>

      {/* ------------------------------------------------------- knee 10 */}
      <div className="card">
        <h2>Knee 10</h2>
        <p className="desc">Every day, evening, ten minutes. Non-negotiable.</p>
        <div className="scroll">
          <table>
            <thead><tr><th>Movement</th><th style={{ width: 110 }}>Dose</th></tr></thead>
            <tbody>
              {KNEE10.map((k) => (
                <tr key={k.move}>
                  <td className="k">{k.move}<div className="xs" style={{ fontWeight: 400, marginTop: 2 }}>{k.why}</div></td>
                  <td className="mono">{k.dose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --------------------------------------------------- the ladder */}
      <div className="card">
        <h2>The plyometric ladder</h2>
        <p className="desc">One rung per block, no skipping. A graft earns its way up rather than starting at the top.</p>
        {LADDER.map((r) => {
          const current = r.n === rung.rung;
          const reached = r.n <= rung.ceiling;
          return (
            <div className="sesh" key={r.n} style={current ? { borderLeft: '3px solid var(--rust)' } : undefined}>
              <div className="sesh-h">
                <span className="slot">{r.months} mo</span>
                <b>Rung {r.n} — {r.name}</b>
                {current && <span className="chip key">Now</span>}
                {!reached && <span className="chip plain">Not yet</span>}
                <span className="mins xs">{rungBlocks(r.n)}</span>
              </div>
              <div className="sesh-b">
                <ul style={{ margin: '0 0 6px', paddingLeft: 18 }}>
                  {r.work.map((w) => <li key={w}>{w}</li>)}
                </ul>
                <div className="xs">{r.why}</div>
              </div>
            </div>
          );
        })}
        <div className="note" style={{ marginBottom: 0 }}>
          <b>The stop rule.</b> Any swelling in the 24 hours after a plyo session drops you back a rung for two weeks. No
          exceptions, no negotiating. This app enforces it automatically from your log — swelling is the joint telling you
          the dose was wrong, and it is the only warning you get before something louder.
        </div>
      </div>

      {/* ------------------------------------------------------ swelling */}
      <div className="card">
        <h2>The swelling test</h2>
        <p className="desc">
          Sit with the leg straight and relaxed. Sweep firmly upward along the inside of the knee two or three times to
          push any fluid out of that hollow. Then stroke down the outside and watch the inside. A small wave returning
          into the hollow is an effusion.
        </p>
        <div className="scroll">
          <table>
            <thead><tr><th>Grade</th><th>What you see</th><th>What to do</th></tr></thead>
            <tbody>
              {SWELLING.map((s) => (
                <tr key={s.grade}>
                  <td className="k"><span className={`chip ${s.band}`}>{s.label}</span></td>
                  <td className="xs">{s.sees}</td>
                  <td className="xs">{s.act}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------------------------------------------------- LSI */}
      <div className="card">
        <h2>Monthly symmetry test</h2>
        <p className="desc">
          First Saturday of the month, before Day 5. Warm up properly first — a cold test gives you a bad number and a
          bad mood. LSI = left ÷ right × 100.
        </p>

        <div className="scroll" style={{ marginBottom: 14 }}>
          <table>
            <thead><tr><th>Test</th><th>Target</th><th style={{ textAlign: 'right' }}>Latest</th></tr></thead>
            <tbody>
              {LSI_TESTS.map((t) => {
                const r = latestByTest.get(t.key);
                const ok = r ? r.lsi >= target : false;
                return (
                  <tr key={t.key}>
                    <td className="k">{t.name}<div className="xs" style={{ fontWeight: 400 }}>{t.protocol}</div></td>
                    <td className="xs">{t.target}</td>
                    <td style={{ textAlign: 'right' }}>
                      {r ? <span className={`chip ${ok ? 'green' : 'amber'}`}>{r.lsi.toFixed(1)}%</span> : <span className="muted">—</span>}
                      {r && <div className="xs">{fmt(r.day)}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <form action={saveLsiAction}>
          <input type="hidden" name="day" value={day} />
          {LSI_TESTS.map((t) => (
            <div key={t.key}>
              <div className="lab" style={{ marginBottom: 4 }}>{t.name}</div>
              <div className="grid2">
                <label className="f"><span className="lab">Left</span><input type="number" step="any" name={`${t.key}_left`} inputMode="decimal" /></label>
                <label className="f"><span className="lab">Right</span><input type="number" step="any" name={`${t.key}_right`} inputMode="decimal" /></label>
              </div>
            </div>
          ))}
          <label className="f"><span className="lab">Note</span><input type="text" name="note" /></label>
          <button className="wide" type="submit">Save the battery</button>
        </form>

        {lsi.length > 0 && (
          <>
            <hr />
            <div className="scroll">
              <table>
                <thead><tr><th>Date</th><th>Test</th><th>L</th><th>R</th><th style={{ textAlign: 'right' }}>LSI</th></tr></thead>
                <tbody>
                  {lsi.map((r) => (
                    <tr key={r.id}>
                      <td className="mono xs">{fmt(r.day)}</td>
                      <td className="xs">{LSI_TESTS.find((t) => t.key === r.test)?.name ?? r.test}</td>
                      <td>{r.left_val}</td>
                      <td>{r.right_val}</td>
                      <td style={{ textAlign: 'right' }}>{r.lsi.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ----------------------------------------------------- red flags */}
      <div className="card">
        <h2>These five do not get managed here</h2>
        <p className="desc">They get looked at by someone with hands. I would rather you lose two weeks to a consultation than a season to a re-rupture.</p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {RED_FLAGS.map((f) => <li key={f} style={{ marginBottom: 4 }}>{f}</li>)}
        </ul>
      </div>

      {/* ------------------------------------------------------- history */}
      {logs.length > 0 && (
        <div className="card">
          <h2>Recent log</h2>
          <div className="scroll">
            <table>
              <thead><tr><th>Date</th><th>Swelling</th><th>Pain</th><th>Knee 10</th><th>Plyo</th></tr></thead>
              <tbody>
                {logs.slice(0, 21).map((l) => (
                  <tr key={l.day}>
                    <td className="mono xs">{fmt(l.day)}</td>
                    <td>{['Zero', 'Trace', '1+', '2+'][l.swelling ?? 0]}</td>
                    <td>{l.pain ?? '—'}</td>
                    <td>{l.knee10 ? '✓' : ''}</td>
                    <td>{l.plyo_done ? '✓' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Nav active="/reference" />
    </div>
  );
}

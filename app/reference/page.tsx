import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { getSettings } from '@/lib/db';
import { context } from '@/lib/coach';
import { toIso, fmt, BLOCKS } from '@/lib/plan';
import {
  targets, STACK, SUPPLEMENTS, CAFFEINE, WEDNESDAY, RACE_DAY,
  SPA, COLD_RULE, SLEEP, PULL_BACK_TRIGGERS, PULL_BACK_ACTIONS,
} from '@/lib/fuel';
import { logoutAction } from '../actions';
import Nav from '../_components/Nav';
import Mast from '../_components/Mast';

export const dynamic = 'force-dynamic';

export default async function ReferencePage() {
  if (!(await currentUser())) redirect('/login');

  const day = toIso(new Date());
  const ctx = context(day);
  const settings = await getSettings();
  const t = targets(settings.weight_kg, day);
  const light = targets(settings.weight_kg, '2026-09-03'); // a Thursday — the light-day number
  const stackP = STACK.reduce((a, s) => a + s.protein, 0);
  const stackK = STACK.reduce((a, s) => a + s.kcal, 0);

  return (
    <div className="wrap">
      <Mast ctx={ctx} title="Reference" />

      <div className="row" style={{ marginBottom: 18 }}>
        <Link href="/gym" className="btn ghost">Gym</Link>
        <Link href="/knee" className="btn ghost">Knee</Link>
        <Link href="/progress" className="btn ghost">Progress</Link>
        <Link href="/settings" className="btn ghost">Settings</Link>
      </div>

      {/* --------------------------------------------------------- fuel */}
      <div className="card">
        <h2>Fuel</h2>
        <p className="desc">Scaled to {settings.weight_kg.toFixed(1)} kg. Recalculate every time bodyweight climbs 3 kg.</p>
        <div className="kpis">
          <div className="kpi acc"><div className="v acc">{t.kcal.toLocaleString()}</div><div className="n">Training day — Mon, Tue, Wed, Fri, Sat</div></div>
          <div className="kpi"><div className="v">{light.kcal.toLocaleString()}</div><div className="n">Light day — Thu, Sun</div></div>
          <div className="kpi"><div className="v">{t.protein} g</div><div className="n">Protein — 1.85 g/kg</div></div>
          <div className="kpi"><div className="v">{t.carbs} g</div><div className="n">Carbs, training day</div></div>
          <div className="kpi"><div className="v">{t.fat} g</div><div className="n">Fat — do not cut it, it is your ballast</div></div>
          <div className="kpi"><div className="v">+{t.surplus}</div><div className="n">Surplus — small, because you have 47 weeks</div></div>
        </div>
        <p className="small muted">
          Protein tops out usefully around 1.6–1.8 g/kg. Above that you are expensively topping up. A number you hit from
          food you actually like beats a higher one you miss four days a week.
        </p>
      </div>

      <div className="card">
        <h2>The repeat stack</h2>
        <p className="desc">Same food, every day. Cook the burgers, meatballs and lasagna in batches at the weekend and freeze them in portions — that is the whole system.</p>
        <div className="scroll">
          <table>
            <thead><tr><th>When</th><th>What</th><th>Protein</th><th style={{ textAlign: 'right' }}>kcal</th></tr></thead>
            <tbody>
              {STACK.map((s) => (
                <tr key={s.when}>
                  <td className="k">{s.when}</td>
                  <td className="xs">{s.what}</td>
                  <td>{s.protein} g</td>
                  <td style={{ textAlign: 'right' }}>{s.kcal}</td>
                </tr>
              ))}
              <tr>
                <td className="k">Total</td>
                <td className="xs">Six things. None of them exotic.</td>
                <td className="k">{stackP} g</td>
                <td className="k" style={{ textAlign: 'right' }}>{stackK.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="xs" style={{ marginTop: 10, marginBottom: 0 }}>
          Milk does a lot of quiet work here: cheapest protein and calories you will find, needs no cooking, and does not
          count as &ldquo;eating&rdquo; when you do not fancy food.
        </p>
      </div>

      <div className="card">
        <h2>Two things worth taking</h2>
        <div className="scroll">
          <table>
            <thead><tr><th>What</th><th>Dose</th><th>Why</th></tr></thead>
            <tbody>
              {SUPPLEMENTS.map((s) => (
                <tr key={s.what}><td className="k">{s.what}</td><td className="mono xs">{s.dose}</td><td className="xs">{s.why}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="note" style={{ marginTop: 14, marginBottom: 0 }}><b>On caffeine.</b> {CAFFEINE}</div>
      </div>

      <div className="card">
        <h2>Wednesday — the day that gets fumbled</h2>
        <p className="desc">Eight hours out of the house, 90 minutes of hard skiing in the middle, and a 2½-hour drive home. Everything here gets packed on Tuesday night.</p>
        <div className="scroll">
          <table>
            <thead><tr><th>Time</th><th>What</th><th>Detail</th></tr></thead>
            <tbody>
              {WEDNESDAY.map((w) => (
                <tr key={w.time}><td className="mono k">{w.time}</td><td className="k">{w.what}</td><td className="xs">{w.detail}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Race day</h2>
        <div className="scroll">
          <table>
            <thead><tr><th>When</th><th>What</th><th>Why</th></tr></thead>
            <tbody>
              {RACE_DAY.map((r) => (
                <tr key={r.when}><td className="mono k">{r.when}</td><td className="k">{r.what}</td><td className="xs">{r.why}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ----------------------------------------------------- recovery */}
      <div className="card">
        <h2>The spa</h2>
        <div className="note"><b>The counter-intuitive bit.</b> {COLD_RULE}</div>
        <div className="scroll">
          <table>
            <thead><tr><th>After…</th><th>Sauna</th><th>Plunge</th><th>Contrast</th><th>Pool</th></tr></thead>
            <tbody>
              {SPA.map((s) => (
                <tr key={s.after}>
                  <td className="k">{s.after}</td>
                  <td className="xs">{s.sauna}</td>
                  <td className="xs">{s.plunge}</td>
                  <td className="xs">{s.contrast}</td>
                  <td className="xs">{s.pool}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="xs" style={{ marginTop: 10, marginBottom: 0 }}>
          Sauna 15–20 min at 80–90 °C, two to four times a week, 500 ml of water with electrolytes afterwards. Contrast
          is 12 min hot → 90 s cold, three rounds — finish cold on a normal day, finish hot the night before you race so
          you sleep.
        </p>
      </div>

      <div className="card">
        <h2>Sleep</h2>
        <div className="scroll">
          <table>
            <thead><tr><th>Night</th><th>Lights out</th><th>Up</th><th style={{ textAlign: 'right' }}>Hours</th></tr></thead>
            <tbody>
              {SLEEP.map((s) => (
                <tr key={s.night}><td className="k">{s.night}</td><td className="mono">{s.out}</td><td className="mono">{s.up}</td><td className="mono" style={{ textAlign: 'right' }}>{s.hours}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="xs" style={{ marginTop: 10, marginBottom: 0 }}>
          Averages 8 h 24 — and the 07:30 floor is the reason. That is the single input that lets you gain lean mass,
          absorb plyometrics and hold a graft-protected leg together across a winter. Thursday 09:00 is a planned wake
          time, not a lie-in you feel guilty about.
        </p>
      </div>

      <div className="card">
        <h2>When to pull back</h2>
        <div className="grid2">
          <div>
            <div className="lab" style={{ marginBottom: 6 }}>Pull the load back a week if…</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {PULL_BACK_TRIGGERS.map((p) => <li key={p} style={{ marginBottom: 4, fontSize: 13.5 }}>{p}</li>)}
            </ul>
          </div>
          <div>
            <div className="lab" style={{ marginBottom: 6 }}>What pulling back looks like</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {PULL_BACK_ACTIONS.map((p) => <li key={p} style={{ marginBottom: 4, fontSize: 13.5 }}>{p}</li>)}
            </ul>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------- blocks */}
      <div className="card">
        <h2>The nine blocks</h2>
        {BLOCKS.map((b) => (
          <div className="sesh" key={b.n} style={b.n === ctx.block.n ? { borderLeft: '3px solid var(--rust)' } : undefined}>
            <div className="sesh-h">
              <span className="slot">{fmt(b.from)} – {fmt(b.to)}</span>
              <b>Block {b.n} — {b.name}</b>
              {b.n === ctx.block.n && <span className="chip key">Now</span>}
              <span className="mins">{b.weeks}w</span>
            </div>
            <div className="sesh-b">
              <p style={{ marginBottom: 8 }}>{b.brief}</p>
              <div className="row">
                {b.targets.map((t2) => <span key={t2} className="chip plain" style={{ flex: '0 0 auto' }}>{t2}</span>)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <form action={logoutAction} style={{ marginTop: 20 }}>
        <button className="ghost wide" type="submit">Sign out</button>
      </form>

      <Nav active="/reference" />
    </div>
  );
}

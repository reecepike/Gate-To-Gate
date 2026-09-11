import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { recentSessions, recentLifts, allJobs } from '@/lib/db';
import { context } from '@/lib/coach';
import { toIso, fmt } from '@/lib/plan';
import { DAYS, gymDayOn } from '@/lib/gym';
import { fmtMinutes } from '@/lib/work';
import { saveSessionAction, deleteSessionAction, saveLiftAction, logWorkAction } from '../actions';
import Nav from '../_components/Nav';
import Mast from '../_components/Mast';

export const dynamic = 'force-dynamic';

const KINDS = [
  ['gym', 'Gym'],
  ['gates', 'Gates — Aldershot'],
  ['stoke', 'Stoke 1-2-1'],
  ['race', 'Race'],
  ['golf', 'Golf'],
  ['swim', 'Swim'],
  ['run', 'Run'],
  ['bike', 'Bike / Z2'],
  ['mtb', 'MTB'],
  ['spa', 'Sauna / contrast'],
];

export default async function LogPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  if (!(await currentUser())) redirect('/login');
  const sp = await searchParams;

  const day = toIso(new Date());
  const ctx = context(day);
  const [sessions, lifts, jobs] = await Promise.all([recentSessions(24), recentLifts(20), allJobs()]);
  const suggested = gymDayOn(day);

  return (
    <div className="wrap">
      <Mast ctx={ctx} title="Log" />

      {sp.saved && <div className="note neutral"><span className="ok">Saved.</span></div>}

      {/* ------------------------------------------------------ session */}
      <form action={saveSessionAction} className="card">
        <h2>Log a session</h2>
        <p className="desc">Everything that costs you something — the gym, the gates, the golf, the spa.</p>

        <div className="grid2">
          <label className="f"><span className="lab">Date</span><input type="date" name="day" defaultValue={day} /></label>
          <label className="f">
            <span className="lab">What</span>
            <select name="kind" defaultValue={suggested ? 'gym' : 'gates'}>
              {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
        </div>

        <label className="f">
          <span className="lab">If it was a gym day, which</span>
          <select name="gym_day" defaultValue={suggested?.key ?? ''}>
            <option value="">—</option>
            {DAYS.map((d) => <option key={d.key} value={d.key}>Day {d.n} — {d.title}</option>)}
          </select>
        </label>

        <div className="grid3">
          <label className="f"><span className="lab">Minutes</span><input type="number" name="duration_min" step="any" defaultValue={suggested?.minutes ?? ''} inputMode="numeric" /></label>
          <label className="f"><span className="lab">RPE 1–10</span><input type="number" name="rpe" min={1} max={10} inputMode="numeric" /></label>
          <label className="f" style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 18 }}>
            <input type="checkbox" name="abandoned" style={{ width: 'auto' }} />
            <span className="small">Abandoned</span>
          </label>
        </div>

        <label className="f"><span className="lab">Title / detail</span><input type="text" name="title" placeholder={suggested ? `Day ${suggested.n} — ${suggested.title}` : 'Free text'} /></label>
        <label className="f"><span className="lab">How it went</span><textarea name="notes" /></label>

        <button className="wide" type="submit">Save session</button>
      </form>

      {/* --------------------------------------------------------- lift */}
      <details className="card">
        <summary><h2 style={{ display: 'inline' }}>Log a top set</h2></summary>
        <p className="desc" style={{ marginTop: 10 }}>
          Only the numbers worth remembering. The pull-up and the single-leg press are the two that tell you whether
          the ten kilos is useful mass.
        </p>
        <form action={saveLiftAction}>
          <div className="grid2">
            <label className="f"><span className="lab">Date</span><input type="date" name="day" defaultValue={day} /></label>
            <label className="f"><span className="lab">Exercise</span><input type="text" name="exercise" required placeholder="Trap bar deadlift" /></label>
          </div>
          <div className="grid3">
            <label className="f"><span className="lab">Load (kg)</span><input type="number" step="any" name="load_kg" inputMode="decimal" /></label>
            <label className="f"><span className="lab">Sets</span><input type="number" name="sets" inputMode="numeric" /></label>
            <label className="f"><span className="lab">Reps</span><input type="number" name="reps" inputMode="numeric" /></label>
          </div>
          <label className="f">
            <span className="lab">Side</span>
            <select name="side" defaultValue="both">
              <option value="both">Both</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </label>
          <label className="f"><span className="lab">Note</span><input type="text" name="note" /></label>
          <button className="wide" type="submit">Save lift</button>
        </form>
      </details>

      {/* --------------------------------------------------------- work */}
      <details className="card">
        <summary><h2 style={{ display: 'inline' }}>Log work time</h2></summary>
        <p className="desc" style={{ marginTop: 10 }}>
          This is what keeps the prioritiser honest. Minutes you never log make every estimate on the Work page wrong in
          the same direction.
        </p>
        <form action={logWorkAction}>
          <div className="grid2">
            <label className="f"><span className="lab">Date</span><input type="date" name="day" defaultValue={day} /></label>
            <label className="f"><span className="lab">Minutes</span><input type="number" name="minutes" step="any" required inputMode="numeric" /></label>
          </div>
          <label className="f">
            <span className="lab">Against which job</span>
            <select name="job_id" defaultValue="">
              <option value="">Not against a job</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}{j.client ? ` — ${j.client}` : ''}</option>)}
            </select>
          </label>
          <label className="f" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" name="finished" style={{ width: 'auto' }} />
            <span className="small">That finished it</span>
          </label>
          <label className="f"><span className="lab">Note</span><input type="text" name="note" /></label>
          <button className="wide" type="submit">Log it</button>
        </form>
      </details>

      {/* ------------------------------------------------------- recent */}
      <div className="card">
        <h2>Recent sessions</h2>
        {!sessions.length && <p className="muted small">Nothing logged yet.</p>}
        {sessions.map((s) => (
          <div className="sesh" key={s.id}>
            <div className="sesh-h">
              <span className="slot">{fmt(s.day)}</span>
              <span className={`disc d-${s.kind}`}>{s.kind}</span>
              <b>{s.title ?? (s.gym_day ? DAYS.find((d) => d.key === s.gym_day)?.title : s.kind)}</b>
              {!s.completed && <span className="chip amber">Abandoned</span>}
              <span className="mins">{s.duration_min ? fmtMinutes(s.duration_min) : '—'}</span>
            </div>
            {(s.notes || s.rpe) && (
              <div className="sesh-b">
                {s.rpe && <span className="lab">RPE {s.rpe}</span>}
                {s.notes && <p style={{ margin: '4px 0 0' }}>{s.notes}</p>}
                <form action={deleteSessionAction} style={{ marginTop: 8 }}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="ghost" type="submit">Delete</button>
                </form>
              </div>
            )}
          </div>
        ))}
      </div>

      {lifts.length > 0 && (
        <div className="card">
          <h2>Recent lifts</h2>
          <div className="scroll">
            <table>
              <thead><tr><th>Date</th><th>Exercise</th><th>Load</th><th>Sets×reps</th><th>Side</th></tr></thead>
              <tbody>
                {lifts.map((l) => (
                  <tr key={l.id}>
                    <td className="mono xs">{fmt(l.day)}</td>
                    <td className="k">{l.exercise}</td>
                    <td>{l.load_kg ?? '—'}</td>
                    <td>{l.sets ?? '—'}×{l.reps ?? '—'}</td>
                    <td className="xs">{l.side}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Nav active="/log" />
    </div>
  );
}

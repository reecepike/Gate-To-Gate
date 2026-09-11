import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { allJobs, doneJobs, getSlots, workLogBetween } from '@/lib/db';
import { context } from '@/lib/coach';
import { queues, workVerdict, nextUp, slotsBetween, capacityMinutes, lostToRaces, fmtMinutes, KINDS } from '@/lib/work';
import { toIso, fmt, addDays, mondayOf } from '@/lib/plan';
import { saveJobAction, setJobStatusAction, deleteJobAction, logWorkAction } from '../actions';
import Nav from '../_components/Nav';
import Mast from '../_components/Mast';
import JobFields from './JobFields';

export const dynamic = 'force-dynamic';

const DAYNAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default async function WorkPage() {
  if (!(await currentUser())) redirect('/login');

  const day = toIso(new Date());
  const [jobs, done, slots] = await Promise.all([allJobs(), doneJobs(12), getSlots()]);
  const logged = await workLogBetween(addDays(day, -27), day);

  const ctx = context(day);
  const q = queues(jobs, day, slots);
  const v = workVerdict(q, day, slots);
  const next = nextUp(q, day, slots);

  const weekMin = capacityMinutes(mondayOf(day), addDays(mondayOf(day), 6), slots);
  const upcoming = slotsBetween(day, addDays(day, 13), slots).slice(0, 6);
  const lost = lostToRaces(day, addDays(day, 13), slots);

  const thisWeekLogged = logged
    .filter((l) => l.day >= mondayOf(day))
    .reduce((a, l) => a + l.minutes, 0);
  const fourWeekLogged = logged.reduce((a, l) => a + l.minutes, 0);

  return (
    <div className="wrap">
      <Mast ctx={ctx} title="Work" />

      <div className={`verdict ${v.band}`}>
        <h2>{v.headline}</h2>
        <p>{v.detail}</p>
      </div>

      <div className="note neutral">
        <b>Next up.</b> {next.line}
      </div>

      {/* ------------------------------------------------------ capacity */}
      <div className="card">
        <h2>What you actually have</h2>
        <p className="desc">
          Capacity comes from your week, not from optimism. RPM hours are not in here — they are already spoken for.
        </p>
        <div className="kpis">
          <div className="kpi acc"><div className="v acc">{fmtMinutes(weekMin)}</div><div className="n">This week, own businesses</div></div>
          <div className="kpi"><div className="v">{fmtMinutes(v.capacity14)}</div><div className="n">Next fortnight</div></div>
          <div className="kpi"><div className="v">{fmtMinutes(v.openMinutes)}</div><div className="n">Open work</div></div>
          <div className="kpi"><div className="v">{fmtMinutes(thisWeekLogged)}</div><div className="n">Logged this week</div></div>
        </div>
        <div className="scroll">
          <table>
            <thead><tr><th>Next slots</th><th>When</th><th style={{ textAlign: 'right' }}>Length</th></tr></thead>
            <tbody>
              {upcoming.map((s, i) => (
                <tr key={i}>
                  <td className="k">{s.slot.label}{s.slot.protected && <span className="chip key" style={{ marginLeft: 6 }}>Protected</span>}</td>
                  <td className="mono xs">{DAYNAMES[(new Date(s.day + 'T12:00:00').getDay() + 6) % 7]} {fmt(s.day)} {s.slot.time}</td>
                  <td style={{ textAlign: 'right' }}>{fmtMinutes(s.slot.minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lost > 0 && (
          <div className="note" style={{ marginTop: 12, marginBottom: 0 }}>
            <b>{fmtMinutes(lost)} of that fortnight is gone to racing.</b> Race days and the evening before them are not
            work evenings, so they have already been taken out of every number above. Better you find that out now than
            at 20:00 on a Saturday in Llandudno.
          </div>
        )}
        <p className="xs" style={{ marginTop: 10, marginBottom: 0 }}>
          Change these in Settings. Be honest — a slot you add and never use makes every number on this page a lie.
          Last four weeks you actually logged {fmtMinutes(fourWeekLogged)}.
        </p>
      </div>

      {/* -------------------------------------------------------- do list */}
      <div className="card">
        <h2>Do, in this order</h2>
        <p className="desc">
          Scored on whether it still fits before the deadline, what it unblocks, what it pays, and how long it has been
          sitting there.
        </p>

        {!q.doNow.length && <p className="muted small">Nothing open. Do not go looking.</p>}

        {q.doNow.map((s, i) => (
          <details key={s.job.id} className="sesh">
            <summary className="sesh-h" style={{ cursor: 'pointer', listStyle: 'none' }}>
              <span className="slot">{i + 1}</span>
              <span className={`disc d-${s.job.kind}`}>{s.job.kind}</span>
              <b>{s.job.title}</b>
              {s.job.client && <span className="xs">{s.job.client}</span>}
              {s.atRisk && <span className="chip red">Will not fit</span>}
              {s.job.dread && <span className="chip amber">Avoided</span>}
              {s.job.status === 'doing' && <span className="chip green">Open</span>}
              <span className="mins">
                {s.job.logged_min > 0 && <s>{fmtMinutes(s.job.est_min)}</s>}
                {fmtMinutes(s.remaining)}
              </span>
            </summary>

            <div className="sesh-b">
              <p style={{ marginBottom: 8 }}>{s.reason}</p>

              {s.job.unblocks && <p className="why" style={{ marginTop: 0 }}>Unblocks: {s.job.unblocks}</p>}
              {s.job.notes && <p className="small muted">{s.job.notes}</p>}

              {s.factors.map((f) => (
                <div className="bar-row" key={f.label}>
                  <span className="nm">{f.label}</span>
                  <span className="bar-track"><i style={{ width: `${Math.round(f.value * 100)}%` }} /></span>
                  <span className="vv">{Math.round(f.value * f.weight)}/{f.weight}</span>
                </div>
              ))}

              <hr />

              <form action={logWorkAction} className="row" style={{ marginBottom: 10 }}>
                <input type="hidden" name="job_id" value={s.job.id} />
                <input type="hidden" name="day" value={day} />
                <input type="number" name="minutes" placeholder="Minutes done" step="any" inputMode="numeric" required />
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', flex: '0 0 auto' }} className="small">
                  <input type="checkbox" name="finished" style={{ width: 'auto' }} /> finished
                </label>
                <button type="submit" style={{ flex: '0 0 auto' }}>Log</button>
              </form>

              <div className="row">
                <form action={setJobStatusAction}>
                  <input type="hidden" name="id" value={s.job.id} />
                  <input type="hidden" name="status" value="done" />
                  <button className="ghost wide" type="submit">Done</button>
                </form>
                <form action={setJobStatusAction}>
                  <input type="hidden" name="id" value={s.job.id} />
                  <input type="hidden" name="status" value="parked" />
                  <button className="ghost wide" type="submit">Park</button>
                </form>
              </div>

              <details style={{ marginTop: 12 }}>
                <summary className="lab" style={{ cursor: 'pointer' }}>Edit</summary>
                <form action={saveJobAction} style={{ marginTop: 12 }}>
                  <JobFields job={s.job} />
                  <div className="row">
                    <button type="submit">Save</button>
                  </div>
                </form>
                <form action={deleteJobAction} style={{ marginTop: 8 }}>
                  <input type="hidden" name="id" value={s.job.id} />
                  <button className="ghost wide" type="submit">Delete</button>
                </form>
              </details>
            </div>
          </details>
        ))}
      </div>

      {/* --------------------------------------------------------- chase */}
      {q.chase.length > 0 && (
        <div className="card">
          <h2>Chase — not do</h2>
          <p className="desc">
            These are blocked on someone else. Leaving them in the do-list is how you feel busy while nothing moves.
          </p>
          {q.chase.map((c) => (
            <div key={c.job.id} className="sesh">
              <div className="sesh-h">
                <span className="disc d-wait">Wait</span>
                <b>{c.job.title}</b>
                <span className="xs">{c.job.client}</span>
                <span className="mins">{c.waitingDays}d</span>
              </div>
              <div className="sesh-b">
                Waiting on <b>{c.job.waiting_on}</b> for {c.waitingDays} day{c.waitingDays === 1 ? '' : 's'}.
                {c.waitingDays >= 7 && ' A week is long enough — chase it today, then park it if they still go quiet.'}
                <form action={setJobStatusAction} style={{ marginTop: 10 }}>
                  <input type="hidden" name="id" value={c.job.id} />
                  <input type="hidden" name="status" value="doing" />
                  <button className="ghost" type="submit">They came back — unblock it</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* -------------------------------------------------------- parked */}
      {q.parked.length > 0 && (
        <div className="card">
          <h2>Parked</h2>
          <p className="desc">Deliberately not being done. That is a decision, and it is the right one when the arithmetic says so.</p>
          {q.parked.map((j) => (
            <div key={j.id} className="sesh">
              <div className="sesh-h">
                <b>{j.title}</b>
                <span className="xs">{j.client}</span>
                <span className="mins">{fmtMinutes(Math.max(j.est_min - j.logged_min, 0))}</span>
              </div>
              <div className="sesh-b">
                <form action={setJobStatusAction}>
                  <input type="hidden" name="id" value={j.id} />
                  <input type="hidden" name="status" value="todo" />
                  <button className="ghost" type="submit">Bring it back</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ----------------------------------------------------------- add */}
      <details className="card" open={!jobs.length}>
        <summary><h2 style={{ display: 'inline' }}>Add a job</h2></summary>
        <p className="desc" style={{ marginTop: 10 }}>
          The estimate is the important field. Guess high — everything on this page is arithmetic against your real
          evenings, and an optimistic estimate just moves the lie somewhere you cannot see it.
        </p>
        <form action={saveJobAction}>
          <JobFields />
          <button className="wide" type="submit">Add it</button>
        </form>
      </details>

      {/* ---------------------------------------------------------- done */}
      {done.length > 0 && (
        <div className="card">
          <h2>Recently finished</h2>
          <div className="scroll">
            <table>
              <thead><tr><th>Job</th><th>Type</th><th style={{ textAlign: 'right' }}>Time</th></tr></thead>
              <tbody>
                {done.map((j) => (
                  <tr key={j.id}>
                    <td className="k">{j.title}{j.client && <div className="xs">{j.client}</div>}</td>
                    <td className="xs">{KINDS.find((k) => k.key === j.kind)?.label ?? j.kind}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMinutes(j.logged_min)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Nav active="/work" />
    </div>
  );
}

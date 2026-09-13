import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { getSettings, getCommitments } from '@/lib/db';
import { hm } from '@/lib/clock';
import { saveFrameAction, saveCommitmentAction, deleteCommitmentAction } from '../actions';
import { logoutAction } from '../actions';
import Nav from '../_components/Nav';

export const dynamic = 'force-dynamic';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * More — the settings that actually change how the app behaves, and the way
 * into everything that does not need its own tab.
 */
export default async function More({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  if (!(await currentUser())) redirect('/login');
  const params = await searchParams;
  const [s, commitments] = await Promise.all([getSettings(), getCommitments()]);

  return (
    <div className="wrap">
      <header className="mast">
        <div>
          <div className="greet">Settings and everything else</div>
          <h1>More</h1>
        </div>
      </header>

      {params.saved && <p className="ok small" style={{ marginBottom: 12 }}>Saved. The plan has been rebuilt from today onwards.</p>}

      <div className="subtabs">
        <Link href="/work">Work</Link>
        <Link href="/gym">Gym</Link>
        <Link href="/knee">Knee</Link>
        <Link href="/log">Log</Link>
        <Link href="/week">Week</Link>
        <Link href="/progress">Progress</Link>
        <Link href="/reference">Reference</Link>
        <Link href="/settings">Athlete</Link>
      </div>

      {/* ------------------------------------------------------ the day frame */}
      <form action={saveFrameAction} className="card">
        <h2>The shape of a day</h2>
        <p className="desc">
          The frame the planner works inside. It places your hours rather than assuming a fixed
          nine to five, so these four numbers decide almost everything about the timetable.
        </p>

        <div className="grid2">
          <label className="f">
            <span className="lab">Wake</span>
            <input type="time" name="wake_time" defaultValue={s.wake_time} />
          </label>
          <label className="f">
            <span className="lab">Lights out</span>
            <input type="time" name="bed_time" defaultValue={s.bed_time} />
          </label>
        </div>

        <label className="f">
          <span className="lab">Sleep target (hours)</span>
          <input type="number" step="any" name="sleep_target_h" inputMode="decimal" defaultValue={s.sleep_target_h} />
        </label>

        <label className="f">
          <span className="lab">RPM hours a working day</span>
          <input type="number" step="any" name="rpm_daily_h" inputMode="decimal" defaultValue={s.rpm_daily_h} />
        </label>
        <p className="xs" style={{ marginTop: -8, marginBottom: 14 }}>
          A budget, not a block. The planner finds {hm(s.rpm_daily_h * 60)} somewhere in the day
          and works around whatever else is fixed.
        </p>

        <label className="f">
          <span className="lab">Work cap (hours)</span>
          <input type="number" step="any" name="work_cap_h" inputMode="decimal" defaultValue={s.work_cap_h} />
        </label>
        <p className="xs" style={{ marginTop: -8, marginBottom: 14 }}>
          Not a hard limit — a deadline can push past it — but past this point more work makes the
          day worse rather than better, and the Today Score treats it that way.
        </p>

        <label className="f">
          <span className="lab">Free time floor (minutes)</span>
          <input type="number" name="free_floor_min" inputMode="numeric" defaultValue={s.free_floor_min} />
        </label>
        <p className="xs" style={{ marginTop: -8, marginBottom: 16 }}>
          Unstructured time the day has to keep. Free time is a feature here, not what happens to
          be left over — the planner stops rather than filling this.
        </p>

        <button className="wide" type="submit">Save the frame</button>
      </form>

      {/* ----------------------------------------------------- commitments */}
      <div className="card">
        <h2>Every week, without fail</h2>
        <p className="desc">
          Recurring commitments the planner protects. Only genuinely immovable things belong here
          — everything else should be free to move, or it stops being a plan and becomes a
          timetable you ignore.
        </p>

        {commitments.length === 0 ? (
          <p className="xs">Nothing recurring. Add the first one below.</p>
        ) : (
          commitments.map((c) => (
            <div key={c.id} className="sesh" style={{ boxShadow: 'none', background: 'var(--surface-2)' }}>
              <div className="sesh-h">
                <span className="slot">{DAYS[c.weekday - 1].slice(0, 3)} {c.start_at}</span>
                <b>{c.title}</b>
                <span className="mins">{hm(c.minutes)}</span>
              </div>
              <div className="sesh-b">
                {c.travel_min > 0 && <div className="xs">{hm(c.travel_min)} travel each way, protected on both sides.</div>}
                {c.notes && <div className="xs" style={{ marginTop: 3 }}>{c.notes}</div>}
                <form action={deleteCommitmentAction} style={{ marginTop: 8 }}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="ghost sm" type="submit">Remove</button>
                </form>
              </div>
            </div>
          ))
        )}

        <details style={{ marginTop: 12 }}>
          <summary className="lab" style={{ cursor: 'pointer' }}>Add a commitment</summary>
          <form action={saveCommitmentAction} style={{ marginTop: 14 }}>
            <label className="f">
              <span className="lab">What</span>
              <input type="text" name="title" required placeholder="Gates — Aldershot" />
            </label>
            <div className="grid3">
              <label className="f">
                <span className="lab">Day</span>
                <select name="weekday" defaultValue="3">
                  {DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
                </select>
              </label>
              <label className="f">
                <span className="lab">Starts</span>
                <input type="time" name="start_at" required defaultValue="18:00" />
              </label>
              <label className="f">
                <span className="lab">Minutes</span>
                <input type="number" name="minutes" inputMode="numeric" required defaultValue={90} />
              </label>
            </div>
            <div className="grid2">
              <label className="f">
                <span className="lab">Kind</span>
                <select name="kind" defaultValue="ski">
                  <option value="ski">Ski</option>
                  <option value="gym">Gym</option>
                  <option value="work">Work</option>
                  <option value="meeting">Meeting</option>
                  <option value="golf">Golf</option>
                  <option value="social">Social</option>
                  <option value="event">Other</option>
                </select>
              </label>
              <label className="f">
                <span className="lab">Travel each way (min)</span>
                <input type="number" name="travel_min" inputMode="numeric" defaultValue={0} />
              </label>
            </div>
            <label className="f">
              <span className="lab">Notes</span>
              <input type="text" name="notes" />
            </label>
            <button className="wide" type="submit">Add it</button>
          </form>
        </details>
      </div>

      <div className="card">
        <h2>How the numbers work</h2>
        <p className="desc">Every score in this app has defined inputs and will say so rather than guess.</p>
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          <li style={{ marginBottom: 8 }}>
            <b>Readiness</b> is scored against your own rolling fortnight, not a population. It needs
            about two weeks of check-ins before the resting-heart-rate part means anything.
          </li>
          <li style={{ marginBottom: 8 }}>
            <b>Today Score</b> measures alignment, not output. Resting correctly on a red day scores
            full marks; twelve hours of work scores worse than seven unless a deadline forced it.
          </li>
          <li style={{ marginBottom: 8 }}>
            <b>Ski readiness</b> is technical, physical, performance and lifestyle, scored only on
            what has actually been logged, and it names the weakest of the four rather than hiding
            it in an average.
          </li>
          <li>
            <b>Goal progress</b> runs from where you started to the target, and knows which goals
            improve by going down. Anything unmeasured says so instead of showing zero.
          </li>
        </ul>
        <p className="xs" style={{ marginTop: 12, marginBottom: 0 }}>
          None of these are medically validated. They are consistent ways of asking the same
          questions so the trend is worth something.
        </p>
      </div>

      <form action={logoutAction}>
        <button className="ghost wide" type="submit">Sign out</button>
      </form>

      <Nav active="/more" />
    </div>
  );
}

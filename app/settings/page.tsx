import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { getSettings, getSlots } from '@/lib/db';
import { context } from '@/lib/coach';
import { toIso } from '@/lib/plan';
import { capacityMinutes, fmtMinutes } from '@/lib/work';
import { addDays, mondayOf } from '@/lib/plan';
import { saveSettingsAction, saveSlotsAction, addSlotAction, logoutAction } from '../actions';
import Nav from '../_components/Nav';
import Mast from '../_components/Mast';

export const dynamic = 'force-dynamic';

const DAYNAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  if (!(await currentUser())) redirect('/login');
  const sp = await searchParams;

  const day = toIso(new Date());
  const ctx = context(day);
  const [settings, slots] = await Promise.all([getSettings(), getSlots()]);
  const weekMin = capacityMinutes(mondayOf(day), addDays(mondayOf(day), 6), slots);

  return (
    <div className="wrap">
      <Mast ctx={ctx} title="Settings" />

      {sp.saved && <div className="note neutral"><span className="ok">Saved.</span></div>}

      <form action={saveSettingsAction} className="card">
        <h2>You</h2>
        <div className="grid2">
          <label className="f"><span className="lab">Name</span><input type="text" name="name" defaultValue={settings.name} /></label>
          <label className="f"><span className="lab">Champs date</span><input type="date" name="champs_date" defaultValue={settings.champs_date} /></label>
        </div>
        <div className="grid3">
          <label className="f"><span className="lab">Weight (kg)</span><input type="number" step="any" name="weight_kg" defaultValue={settings.weight_kg} inputMode="decimal" /></label>
          <label className="f"><span className="lab">Golf handicap</span><input type="number" step="any" name="handicap" defaultValue={settings.handicap ?? ''} inputMode="decimal" /></label>
          <label className="f"><span className="lab">RPM hours/week</span><input type="number" name="rpm_hours" defaultValue={settings.rpm_hours} inputMode="numeric" /></label>
        </div>
        <p className="xs">
          Weight updates itself from the Saturday weigh-in — it is the 14-day average, not the last number, because a
          single morning tells you about salt and sleep rather than about muscle.
        </p>
        <button className="wide" type="submit">Save</button>
      </form>

      {/* -------------------------------------------------- work slots */}
      <form action={saveSlotsAction} className="card">
        <h2>Your real work capacity</h2>
        <p className="desc">
          This is the most important setting in the app. Every number on the Work page is arithmetic against these
          minutes — inflate them and the prioritiser will cheerfully tell you a job fits when it does not.
          Currently {fmtMinutes(weekMin)} a week for RP Web Studio and Lyne MTB. Set a slot to 0 to delete it.
        </p>
        {slots.map((s) => (
          <div key={`${s.weekday}-${s.time}`} className="row" style={{ alignItems: 'center', marginBottom: 10 }}>
            <span style={{ flex: 2 }}>
              <b style={{ fontSize: 14 }}>{DAYNAMES[s.weekday - 1]} {s.time}</b>
              <div className="xs">{s.label}{s.protected && ' · ring-fenced'}</div>
            </span>
            <input
              type="number"
              name={`slot_${s.weekday}_${s.time.replace(':', '')}`}
              defaultValue={s.minutes}
              step="any"
              inputMode="numeric"
              style={{ flex: 1 }}
              aria-label={`${DAYNAMES[s.weekday - 1]} ${s.time} minutes`}
            />
          </div>
        ))}
        <button className="wide" type="submit">Save capacity</button>
      </form>

      <details className="card">
        <summary><h2 style={{ display: 'inline' }}>Add a slot</h2></summary>
        <p className="desc" style={{ marginTop: 10 }}>
          Only add one you will genuinely use. Wednesday has none on purpose — you get home at 23:45.
        </p>
        <form action={addSlotAction}>
          <div className="grid2">
            <label className="f">
              <span className="lab">Day</span>
              <select name="weekday" defaultValue="7">
                {DAYNAMES.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
              </select>
            </label>
            <label className="f"><span className="lab">Start</span><input type="time" name="time" defaultValue="20:00" /></label>
          </div>
          <div className="grid2">
            <label className="f"><span className="lab">Minutes</span><input type="number" name="minutes" step="any" defaultValue={60} inputMode="numeric" /></label>
            <label className="f"><span className="lab">Label</span><input type="text" name="label" placeholder="Thursday evening" /></label>
          </div>
          <button className="wide" type="submit">Add</button>
        </form>
      </details>

      <div className="card">
        <h2>What this app will not do</h2>
        <p className="small muted" style={{ marginBottom: 0 }}>
          It cannot put hands on the joint, watch you land, or diagnose anything new. Movement quality is eyes-on work
          and it is where the real risk lives. The five red-flag symptoms on the Knee page go to a sports physio or your
          surgeon&rsquo;s team, not here — and the one screening worth paying for is a single 45-minute session before
          Rung 3.
        </p>
      </div>

      <form action={logoutAction}>
        <button className="ghost wide" type="submit">Sign out</button>
      </form>

      <Nav active="/reference" />
    </div>
  );
}

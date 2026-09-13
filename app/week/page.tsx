import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { ticksFor, getSlots } from '@/lib/db';
import { context } from '@/lib/coach';
import { WEEK, WEEK_TASKS, RACE_OVERRIDE } from '@/lib/week';
import { toIso, fmt, mondayOf, addDays, weekFor } from '@/lib/plan';
import { daysInBlock } from '@/lib/gym';
import { slotsOn, fmtMinutes } from '@/lib/work';
import { toggleTickAction, resetWeekAction, saveWeeklyNoteAction } from '../actions';
import Nav from '../_components/Nav';
import Mast from '../_components/Mast';

export const dynamic = 'force-dynamic';

export default async function WeekPage() {
  if (!(await currentUser())) redirect('/login');

  const day = toIso(new Date());
  const ctx = context(day);
  const week = weekFor(day);
  const [ticks, slots] = await Promise.all([ticksFor(week), getSlots()]);
  const mon = mondayOf(day);
  const doneCount = WEEK_TASKS.filter((t) => ticks[t]).length;
  const lifting = daysInBlock(ctx.block);

  return (
    <div className="wrap">
      <Mast ctx={ctx} title="The week" />

      <div className="note neutral">
        <b>Two fixed points.</b> Nothing starts before 07:30, and Wednesday belongs to Aldershot. Everything else is
        arranged around those — which is why the gym sits at 08:15 and Wednesday compresses to a 5¾-hour working day.
      </div>

      {ctx.raceWeek && (
        <div className="verdict amber">
          <h2>Race week — {ctx.raceWeek.name}</h2>
          <p>{fmt(ctx.raceWeek.day)}{ctx.raceWeek.end !== ctx.raceWeek.day && `–${fmt(ctx.raceWeek.end)}`} · {ctx.raceWeek.venue} · aim: {ctx.raceWeek.aim}. The override below applies.</p>
        </div>
      )}

      <div className="kpis">
        <div className="kpi acc"><div className="v acc">{lifting.length}</div><div className="n">Lifting days this block</div></div>
        <div className="kpi"><div className="v">90 min</div><div className="n">On plastic — plus Stoke 1-2-1s</div></div>
        <div className="kpi"><div className="v">8.4 h</div><div className="n">Sleep, weekly average</div></div>
        <div className="kpi"><div className="v">{doneCount}/{WEEK_TASKS.length}</div><div className="n">Ticked this week</div></div>
      </div>

      {/* --------------------------------------------------- the days */}
      {WEEK.map((d) => {
        const dayIso = addDays(mon, d.weekday - 1);
        const isToday = dayIso === day;
        const ws = slotsOn(dayIso, slots);
        return (
          <div className="card" key={d.weekday} style={isToday ? { borderLeft: '3px solid var(--rust)' } : undefined}>
            <h2>
              {d.name}
              {isToday && <span className="chip key" style={{ marginLeft: 8 }}>Today</span>}
            </h2>
            <p className="desc">{d.headline} · {fmt(dayIso)}</p>
            {d.slots.map((s) => (
              <div key={s.time + s.label} style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--rule-2)' }}>
                <span className="mono xs" style={{ width: 46, flexShrink: 0, paddingTop: 2 }}>{s.time}</span>
                <span style={{ flex: 1 }}>
                  <b style={{ fontSize: 14 }}>{s.label}</b>
                  {s.detail && <div className="xs" style={{ marginTop: 2 }}>{s.detail}</div>}
                </span>
              </div>
            ))}
            {ws.length > 0 && (
              <p className="xs" style={{ marginTop: 10, marginBottom: 0 }}>
                Own businesses: {ws.map((s) => `${s.time} (${fmtMinutes(s.minutes)})`).join(' · ')}
              </p>
            )}
          </div>
        );
      })}

      {/* ------------------------------------------------- race override */}
      <div className="card">
        <h2>Race weekend override</h2>
        <p className="desc">Swap this in when you are racing Saturday or Sunday.</p>
        <div className="scroll">
          <table>
            <thead><tr><th>Day</th><th>Change</th><th>Why</th></tr></thead>
            <tbody>
              {RACE_OVERRIDE.map((r) => (
                <tr key={r.day}>
                  <td className="k mono">{r.day}</td>
                  <td>{r.change}</td>
                  <td className="xs">{r.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------------------------------------------- the ticks */}
      <div className="card">
        <h2>This week&rsquo;s ticks</h2>
        <p className="desc">Week {week} · {doneCount} of {WEEK_TASKS.length} done</p>
        {WEEK_TASKS.map((t) => {
          const on = !!ticks[t];
          return (
            <form action={toggleTickAction} key={t}>
              <input type="hidden" name="week" value={week} />
              <input type="hidden" name="task" value={t} />
              <input type="hidden" name="done" value={on ? 'false' : 'true'} />
              <button
                type="submit"
                className="tick"
                aria-pressed={on}
              >
                <span className="box">{on ? '✓' : ''}</span>
                <span className={on ? 'struck' : ''}>{t}</span>
              </button>
            </form>
          );
        })}
        <form action={resetWeekAction} style={{ marginTop: 12 }}>
          <input type="hidden" name="week" value={week} />
          <button className="ghost wide" type="submit">Reset the week</button>
        </form>
      </div>

      {/* ------------------------------------------------- weekly note */}
      <form action={saveWeeklyNoteAction} className="card">
        <h2>Sunday, ten minutes</h2>
        <p className="desc">The slot at 20:00. Three lines is enough — it is the thing that makes next week better than this one.</p>
        <input type="hidden" name="week" value={week} />
        <label className="f"><span className="lab">What went well</span><textarea name="went_well" /></label>
        <label className="f"><span className="lab">What did not</span><textarea name="went_badly" /></label>
        <label className="f"><span className="lab">One change for next week</span><input type="text" name="one_change" /></label>
        <button className="wide" type="submit">Save the week</button>
      </form>

      <Nav active="/week" />
    </div>
  );
}

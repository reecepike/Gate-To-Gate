import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { allGoals, allMilestones, goalHistory } from '@/lib/db';
import { progressOf, type Goal } from '@/lib/goals';
import { fmt, daysBetween, toIso } from '@/lib/plan';
import { saveGoalAction, setGoalStatusAction } from '../actions';
import Nav from '../_components/Nav';
import { Bar } from '../_components/Ring';

export const dynamic = 'force-dynamic';

const AREAS = ['ski', 'business', 'brand', 'golf', 'fitness', 'money', 'life'];

const AREA_LABEL: Record<string, string> = {
  ski: 'Skiing', business: 'Business', brand: 'Personal brand',
  golf: 'Golf', fitness: 'Fitness', money: 'Money', life: 'Life',
};

/**
 * Goals, and honest progress.
 *
 * Deliberately separate from the Today Score: one answers "did I execute
 * today", the other answers "am I getting closer". A good day is not progress,
 * and a run of them that moves nothing long-term is exactly the thing this page
 * exists to make visible.
 */
export default async function Goals({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; add?: string }>;
}) {
  if (!(await currentUser())) redirect('/login');
  const params = await searchParams;
  const today = toIso(new Date());

  const [goals, milestones] = await Promise.all([allGoals(), allMilestones()]);
  const active = goals.filter((g) => g.status === 'active');
  const paused = goals.filter((g) => g.status === 'paused');

  const histories = await Promise.all(active.map((g) => goalHistory(g.id, 30)));
  const views = active.map((g, i) => progressOf(g as Goal, milestones, histories[i]));

  const editing = params.edit ? goals.find((g) => String(g.id) === params.edit) ?? null : null;
  const showForm = !!editing || params.add === '1';

  const measured = views.filter((v) => v.measured);
  const overall = measured.length
    ? Math.round(measured.reduce((a, v) => a + (v.pct ?? 0), 0) / measured.length)
    : null;

  return (
    <div className="wrap">
      <header className="mast">
        <div>
          <div className="greet">The long game</div>
          <h1>Goals</h1>
        </div>
      </header>

      <div className="hero">
        <div className="lab">Across everything measured</div>
        <div className="big">
          {overall == null ? '—' : overall}{overall != null && <small>%</small>}
        </div>
        <p>
          {overall == null
            ? 'Nothing has a number against it yet. Log a race, a round or a follower count and these come alive.'
            : `${measured.length} of ${active.length} goals have data behind them. The other ${active.length - measured.length} are shown honestly as unmeasured rather than sitting at zero.`}
        </p>
      </div>

      {!showForm && (
        <>
          {AREAS.filter((a) => views.some((v) => v.goal.area === a)).map((area) => (
            <div className="card" key={area}>
              <h2>{AREA_LABEL[area]}</h2>
              <p className="desc">{areaBlurb(area)}</p>
              {views.filter((v) => v.goal.area === area).map((v) => (
                <div key={v.goal.id} className="goal-row">
                  <div className="top">
                    <b>{v.goal.title}</b>
                    <span className="pc">{v.pct == null ? '—' : `${v.pct}%`}</span>
                  </div>
                  <Bar pct={v.pct} area={v.goal.area} />

                  <div style={{ display: 'flex', gap: 14, marginTop: 9, flexWrap: 'wrap' }}>
                    <span className="xs"><b style={{ color: 'var(--ink)' }}>{v.currentLabel}</b> now</span>
                    <span className="xs">target {v.targetLabel}</span>
                    {v.deltaLabel && <span className="xs">{v.deltaLabel}</span>}
                    {v.goal.target_date && (
                      <span className="xs">
                        {daysBetween(today, v.goal.target_date)} days left
                      </span>
                    )}
                  </div>

                  {(v.hit || v.next) && (
                    <div className="xs" style={{ marginTop: 7 }}>
                      {v.hit && <>Reached: <b style={{ color: 'var(--ink)' }}>{v.hit.label}</b>. </>}
                      {v.next && <>Next: <b style={{ color: 'var(--accent-ink)' }}>{v.next.label}</b>.</>}
                    </div>
                  )}

                  <div className="xs" style={{ marginTop: 7 }}>{v.action}</div>

                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <Link href={`/goals?edit=${v.goal.id}`} className="btn ghost sm">Update</Link>
                    <form action={setGoalStatusAction}>
                      <input type="hidden" name="id" value={v.goal.id} />
                      <input type="hidden" name="status" value="paused" />
                      <button className="ghost sm" type="submit">Pause</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {active.length === 0 && (
            <div className="card empty">
              <div className="ic">◎</div>
              <b>No goals yet</b>
              <p>A goal here is anything with a number and a direction — a handicap, a follower count, a monthly revenue figure, a leg press.</p>
              <Link href="/goals?add=1" className="btn">Add a goal</Link>
            </div>
          )}

          {paused.length > 0 && (
            <div className="card">
              <h2>Paused</h2>
              <p className="desc">Still here, not being counted.</p>
              {paused.map((g) => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--rule-2)' }}>
                  <span className="small">{g.title}</span>
                  <form action={setGoalStatusAction} style={{ marginLeft: 'auto' }}>
                    <input type="hidden" name="id" value={g.id} />
                    <input type="hidden" name="status" value="active" />
                    <button className="ghost sm" type="submit">Resume</button>
                  </form>
                </div>
              ))}
            </div>
          )}

          <Link href="/goals?add=1" className="btn ghost wide">Add a goal</Link>
        </>
      )}

      {/* ------------------------------------------------------------- form */}
      {showForm && (
        <form action={saveGoalAction} className="card">
          <h2>{editing ? editing.title : 'New goal'}</h2>
          <p className="desc">
            {editing
              ? 'Updating the current value also records it as a data point, so the trend builds itself.'
              : 'Give it a number and a direction. Anything without both is an intention rather than a goal.'}
          </p>
          {editing && <input type="hidden" name="id" value={editing.id} />}

          <label className="f">
            <span className="lab">Goal</span>
            <input type="text" name="title" required defaultValue={editing?.title ?? ''} />
          </label>

          <div className="grid2">
            <label className="f">
              <span className="lab">Area</span>
              <select name="area" defaultValue={editing?.area ?? 'life'}>
                {AREAS.map((a) => <option key={a} value={a}>{AREA_LABEL[a]}</option>)}
              </select>
            </label>
            <label className="f">
              <span className="lab">Unit</span>
              <input type="text" name="unit" defaultValue={editing?.unit ?? ''} placeholder="kg, £, pts" />
            </label>
          </div>

          <div className="grid3">
            <label className="f">
              <span className="lab">Started at</span>
              <input type="number" step="any" name="start_value" inputMode="decimal"
                defaultValue={editing?.start_value ?? ''} />
            </label>
            <label className="f">
              <span className="lab">Now</span>
              <input type="number" step="any" name="current_value" inputMode="decimal"
                defaultValue={editing?.current_value ?? ''} />
            </label>
            <label className="f">
              <span className="lab">Target</span>
              <input type="number" step="any" name="target_value" inputMode="decimal"
                defaultValue={editing?.target_value ?? ''} />
            </label>
          </div>

          <label className="f" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="checkbox" name="lower_better" defaultChecked={editing?.lower_better ?? false} />
            <span className="small">Lower is better (handicaps, race points, positions)</span>
          </label>

          <div className="grid2">
            <label className="f">
              <span className="lab">Target date</span>
              <input type="date" name="target_date" defaultValue={editing?.target_date ?? ''} />
            </label>
            <label className="f">
              <span className="lab">Status</span>
              <select name="status" defaultValue={editing?.status ?? 'active'}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="done">Done</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>

          <label className="f">
            <span className="lab">What actually moves it</span>
            <input type="text" name="metric" defaultValue={editing?.metric ?? ''} />
          </label>

          <button className="wide" type="submit">{editing ? 'Save' : 'Create it'}</button>
          <p className="center" style={{ marginTop: 10, marginBottom: 0 }}>
            <Link href="/goals" className="xs">Cancel</Link>
          </p>
        </form>
      )}

      <p className="xs center">Updated {fmt(today)}.</p>
      <Nav active="/goals" />
    </div>
  );
}

function areaBlurb(area: string): string {
  const m: Record<string, string> = {
    ski: 'The one everything else is arranged around.',
    business: 'Revenue under management, not hours worked.',
    brand: 'Slow, compounding, and the easiest to let slide.',
    golf: 'Four cards and the handicap starts telling the truth.',
    fitness: 'Progressive overload, tracked in the gym log.',
    money: 'Blanks are fine here. Made-up numbers are not.',
    life: '',
  };
  return m[area] ?? '';
}

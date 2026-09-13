import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { skiRaces, runsForRaces, skiSessions, getSettings } from '@/lib/db';
import { raceTotal, behindPct, FORMATS, type RaceFormat } from '@/lib/ski';
import { toIso, fmt } from '@/lib/plan';
import { saveRaceAction, deleteRaceAction, saveSkiSessionAction } from '../../actions';
import Nav from '../../_components/Nav';

export const dynamic = 'force-dynamic';

/**
 * Ski racing.
 *
 * Runs are logged individually and the total is always computed, never typed.
 * The two formats add up differently — best of runs 1 and 2 plus run 3 for a
 * club national, run 1 plus run 2 for a championship — and a hand-entered total
 * is exactly how that goes quietly wrong across a season.
 */
export default async function Ski({
  searchParams,
}: {
  searchParams: Promise<{ add?: string; fmt?: string; sess?: string }>;
}) {
  if (!(await currentUser())) redirect('/login');
  const params = await searchParams;
  const today = toIso(new Date());

  const [races, sessions, settings] = await Promise.all([
    skiRaces(40), skiSessions(30), getSettings(),
  ]);
  const runs = await runsForRaces(races.map((r) => r.id));

  const adding = params.add === '1';
  const addingSession = params.sess === '1';
  const format = (params.fmt as RaceFormat) ?? 'club';
  const runCount = format === 'club' ? 3 : 2;

  return (
    <div className="wrap">
      <header className="mast">
        <div>
          <div className="greet">Results, runs and gate time</div>
          <h1>Ski racing</h1>
        </div>
        {settings.obarts_points != null && (
          <div className="right">
            <div><div className="lab">O-Barts</div><div className="v">{settings.obarts_points}</div></div>
          </div>
        )}
      </header>

      <div className="subtabs">
        <Link href="/track/ski" className={!adding && !addingSession ? 'on' : ''}>Races</Link>
        <Link href="/track/ski?add=1" className={adding ? 'on' : ''}>Log a race</Link>
        <Link href="/track/ski?sess=1" className={addingSession ? 'on' : ''}>Log a session</Link>
      </div>

      {/* -------------------------------------------------------- add race */}
      {adding && (
        <form action={saveRaceAction} className="card">
          <h2>Log a race</h2>
          <p className="desc">
            Enter each run. The total works itself out from the format — {FORMATS.find((f) => f.key === format)!.rule.toLowerCase()}
          </p>

          <div className="row" style={{ marginBottom: 14 }}>
            {FORMATS.map((f) => (
              <Link
                key={f.key}
                href={`/track/ski?add=1&fmt=${f.key}`}
                className={`btn ${format === f.key ? '' : 'ghost'} sm`}
              >
                {f.label}
              </Link>
            ))}
          </div>
          <input type="hidden" name="format" value={format} />

          <label className="f">
            <span className="lab">Race</span>
            <input type="text" name="name" required placeholder="Llandudno Club National" />
          </label>
          <div className="grid2">
            <label className="f">
              <span className="lab">Date</span>
              <input type="date" name="day" required defaultValue={today} />
            </label>
            <label className="f">
              <span className="lab">Venue</span>
              <input type="text" name="venue" />
            </label>
          </div>
          <div className="grid2">
            <label className="f">
              <span className="lab">Surface</span>
              <select name="surface" defaultValue="dry">
                <option value="dry">Dry slope</option>
                <option value="snow">Snow</option>
              </select>
            </label>
            <label className="f">
              <span className="lab">Discipline</span>
              <select name="discipline" defaultValue="slalom">
                <option value="slalom">Slalom</option>
                <option value="giant-slalom">Giant slalom</option>
              </select>
            </label>
          </div>

          <hr />
          <div className="lab" style={{ marginBottom: 10 }}>The runs</div>
          {Array.from({ length: runCount }, (_, n) => n + 1).map((n) => (
            <div className="grid3" key={n}>
              <label className="f">
                <span className="lab">Run {n} (s)</span>
                <input type="number" step="any" name={`run${n}`} inputMode="decimal" placeholder="42.18" />
              </label>
              <label className="f">
                <span className="lab">Status</span>
                <select name={`run${n}_status`} defaultValue="ok">
                  <option value="ok">Finished</option>
                  <option value="dnf">DNF</option>
                  <option value="dsq">DSQ</option>
                  <option value="dns">DNS</option>
                </select>
              </label>
              <label className="f">
                <span className="lab">Penalty (s)</span>
                <input type="number" step="any" name={`run${n}_pen`} inputMode="decimal" />
              </label>
            </div>
          ))}

          <hr />
          <div className="grid3">
            <label className="f">
              <span className="lab">Position</span>
              <input type="number" name="position" inputMode="numeric" />
            </label>
            <label className="f">
              <span className="lab">Field size</span>
              <input type="number" name="field_size" inputMode="numeric" />
            </label>
            <label className="f">
              <span className="lab">Winner (s)</span>
              <input type="number" step="any" name="winner_sec" inputMode="decimal" />
            </label>
          </div>
          <label className="f">
            <span className="lab">O-Barts points</span>
            <input type="number" step="any" name="obarts" inputMode="decimal" />
          </label>
          <p className="xs" style={{ marginTop: -6, marginBottom: 14 }}>
            Entered by hand, deliberately. The official calculation depends on the field and on
            penalties this app does not hold, and a number invented here would look exactly like
            a real one.
          </p>
          <label className="f">
            <span className="lab">Notes</span>
            <input type="text" name="notes" placeholder="Lost it at the third delay gate both runs" />
          </label>
          <button className="wide" type="submit">Save the race</button>
        </form>
      )}

      {/* ----------------------------------------------------- add session */}
      {addingSession && (
        <form action={saveSkiSessionAction} className="card">
          <h2>Log a ski session</h2>
          <p className="desc">Gate time is what moves the technical half of the readiness score.</p>
          <div className="grid2">
            <label className="f">
              <span className="lab">Date</span>
              <input type="date" name="day" required defaultValue={today} />
            </label>
            <label className="f">
              <span className="lab">Kind</span>
              <select name="kind" defaultValue="gates">
                <option value="gates">Gates</option>
                <option value="free">Free skiing</option>
                <option value="starts">Starts</option>
                <option value="technical">Technical</option>
                <option value="conditioning">Conditioning</option>
                <option value="mobility">Mobility</option>
              </select>
            </label>
          </div>
          <div className="grid3">
            <label className="f">
              <span className="lab">Venue</span>
              <input type="text" name="venue" placeholder="Aldershot" />
            </label>
            <label className="f">
              <span className="lab">Minutes</span>
              <input type="number" name="duration_min" inputMode="numeric" defaultValue={90} />
            </label>
            <label className="f">
              <span className="lab">Runs</span>
              <input type="number" name="runs" inputMode="numeric" />
            </label>
          </div>
          <label className="f">
            <span className="lab">Focus</span>
            <input type="text" name="focus" placeholder="Early edge, outside ski" />
          </label>
          <div className="grid2">
            <label className="f">
              <span className="lab">Intensity 1–10</span>
              <input type="number" name="intensity" inputMode="numeric" min={1} max={10} />
            </label>
            <label className="f">
              <span className="lab">Confidence 1–10</span>
              <input type="number" name="confidence" inputMode="numeric" min={1} max={10} />
            </label>
          </div>
          <label className="f">
            <span className="lab">Notes</span>
            <input type="text" name="notes" />
          </label>
          <button className="wide" type="submit">Log it</button>
        </form>
      )}

      {/* -------------------------------------------------------- the races */}
      {!adding && !addingSession && (
        <>
          {races.length === 0 ? (
            <div className="card empty">
              <div className="ic">⛷</div>
              <b>No races logged</b>
              <p>
                Each race stores its individual runs, so the total follows the format rather than
                being typed in. That is what makes comparing two seasons worth anything.
              </p>
              <Link href="/track/ski?add=1" className="btn">Log a race</Link>
            </div>
          ) : (
            races.map((r) => {
              const rs = runs[r.id] ?? [];
              const res = raceTotal(r.format, rs);
              const pct = behindPct(res.total ?? r.total_sec, r.winner_sec);
              return (
                <div key={r.id} className="sesh">
                  <div className="sesh-h">
                    <span className="slot">{fmt(r.day)}</span>
                    <span className="disc d-race">{r.format === 'club' ? 'Club' : 'Champs'}</span>
                    <b>{r.name}</b>
                    <span className="mins">{res.total != null ? `${res.total.toFixed(2)}s` : '—'}</span>
                  </div>
                  <div className="sesh-b">
                    <div className="scroll" style={{ marginBottom: 8 }}>
                      <table>
                        <thead>
                          <tr><th>Run</th><th>Time</th><th>Counts</th></tr>
                        </thead>
                        <tbody>
                          {rs.map((run) => (
                            <tr key={run.run_no}>
                              <td className="k">Run {run.run_no}</td>
                              <td>
                                {run.status !== 'ok'
                                  ? run.status.toUpperCase()
                                  : `${run.time_sec?.toFixed(2) ?? '—'}${run.penalty ? ` +${run.penalty}` : ''}`}
                              </td>
                              <td className="xs">
                                {res.counted.includes(run.run_no) ? 'counts' : res.dropped.includes(run.run_no) ? 'dropped' : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="why">{res.complete ? res.explain : res.problem}</div>
                    <div className="xs" style={{ marginTop: 7 }}>
                      {r.position && `${r.position}${r.field_size ? ` of ${r.field_size}` : ''}`}
                      {pct != null && ` · ${pct > 0 ? '+' : ''}${pct}% on the winner`}
                      {r.obarts != null && ` · ${r.obarts} O-Barts`}
                      {r.venue && ` · ${r.venue}`}
                    </div>
                    {r.notes && <div className="xs" style={{ marginTop: 4 }}>{r.notes}</div>}
                    <form action={deleteRaceAction} style={{ marginTop: 9 }}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="ghost sm" type="submit">Delete</button>
                    </form>
                  </div>
                </div>
              );
            })
          )}

          {sessions.length > 0 && (
            <div className="card">
              <h2>Recent sessions</h2>
              <p className="desc">Gate time, and what it felt like.</p>
              <div className="scroll">
                <table>
                  <thead><tr><th>Date</th><th>Kind</th><th>Min</th><th>Conf.</th><th>Focus</th></tr></thead>
                  <tbody>
                    {sessions.slice(0, 12).map((s) => (
                      <tr key={s.id}>
                        <td className="k">{fmt(s.day)}</td>
                        <td>{s.kind}</td>
                        <td>{s.duration_min ?? '—'}</td>
                        <td>{s.confidence ?? '—'}</td>
                        <td className="xs">{s.focus ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <Nav active="/track" />
    </div>
  );
}

import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { golfRounds, getSettings } from '@/lib/db';
import { toIso, fmt } from '@/lib/plan';
import { saveGolfAction } from '../../actions';
import Nav from '../../_components/Nav';
import { Ring } from '../../_components/Ring';

export const dynamic = 'force-dynamic';

export default async function Golf() {
  if (!(await currentUser())) redirect('/login');
  const today = toIso(new Date());
  const [rounds, settings] = await Promise.all([golfRounds(40), getSettings()]);

  const withHcp = rounds.filter((r) => r.handicap != null);
  const current = settings.golf_handicap ?? withHcp[0]?.handicap ?? null;
  const first = withHcp[withHcp.length - 1]?.handicap ?? null;
  // Lower is better, so progress runs from where you started down towards ten.
  const pct = current != null && first != null && first > 10
    ? Math.round(Math.max(0, Math.min(100, ((first - current) / (first - 10)) * 100)))
    : null;

  const scores = rounds.filter((r) => r.score != null && r.holes === 18);
  const best = scores.length ? Math.min(...scores.map((r) => r.score!)) : null;
  const avg = scores.length ? Math.round(scores.reduce((a, r) => a + r.score!, 0) / scores.length) : null;

  return (
    <div className="wrap">
      <header className="mast">
        <div>
          <div className="greet">Towards a 10 handicap</div>
          <h1>Golf</h1>
        </div>
      </header>

      <div className="hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Ring pct={pct} value={current != null ? String(current) : '—'} label="hcp" size={92} colour="var(--run)" />
          <div>
            <div className="lab">Playing handicap</div>
            <h2 style={{ marginTop: 4 }}>
              {current == null ? 'Not set yet' : current <= 10 ? 'Target reached' : `${(current - 10).toFixed(1)} to go`}
            </h2>
            <p style={{ marginTop: 6 }}>
              {rounds.length
                ? `${rounds.length} round${rounds.length === 1 ? '' : 's'} logged${best ? `, best 18 of ${best}` : ''}.`
                : 'Four cards and the handicap starts telling the truth.'}
            </p>
          </div>
        </div>
      </div>

      {rounds.length === 0 ? (
        <div className="card empty">
          <div className="ic">⛳</div>
          <b>No rounds yet</b>
          <p>Score, course and date. Nothing else unless you ask for it — fairways and putting stats can wait until they would actually change a decision.</p>
        </div>
      ) : (
        <div className="card">
          <h2>Rounds</h2>
          <p className="desc">
            {avg != null && `Averaging ${avg} over ${scores.length} full rounds. `}
            Walking eighteen is about twelve thousand steps — it counts as aerobic work, not a rest day.
          </p>
          <div className="scroll">
            <table>
              <thead><tr><th>Date</th><th>Course</th><th>Score</th><th>Hcp</th></tr></thead>
              <tbody>
                {rounds.map((r) => (
                  <tr key={r.id}>
                    <td className="k">{fmt(r.day)}</td>
                    <td className="xs">{r.course ?? '—'}</td>
                    <td>{r.score ?? '—'}{r.par ? ` (${r.score! > r.par ? '+' : ''}${r.score! - r.par})` : ''}</td>
                    <td>{r.handicap ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <form action={saveGolfAction} className="card">
        <h2>Add a round</h2>
        <div className="grid2">
          <label className="f">
            <span className="lab">Date</span>
            <input type="date" name="day" required defaultValue={today} />
          </label>
          <label className="f">
            <span className="lab">Course</span>
            <input type="text" name="course" />
          </label>
        </div>
        <div className="grid3">
          <label className="f">
            <span className="lab">Holes</span>
            <select name="holes" defaultValue="18"><option>18</option><option>9</option></select>
          </label>
          <label className="f">
            <span className="lab">Score</span>
            <input type="number" name="score" inputMode="numeric" />
          </label>
          <label className="f">
            <span className="lab">Par</span>
            <input type="number" name="par" inputMode="numeric" placeholder="72" />
          </label>
        </div>
        <label className="f">
          <span className="lab">Playing handicap after this round</span>
          <input type="number" step="any" name="handicap" inputMode="decimal" defaultValue={current ?? ''} />
        </label>
        <label className="f">
          <span className="lab">Notes</span>
          <input type="text" name="notes" />
        </label>
        <button className="wide" type="submit">Save the round</button>
      </form>

      <Nav active="/track" />
    </div>
  );
}

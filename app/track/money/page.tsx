import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { moneyRows, allGoals } from '@/lib/db';
import { toIso, fmt, daysBetween } from '@/lib/plan';
import { saveMoneyAction, deleteMoneyAction } from '../../actions';
import Nav from '../../_components/Nav';

export const dynamic = 'force-dynamic';

const KINDS = [
  { key: 'income', label: 'Income' },
  { key: 'expense', label: 'Expense' },
  { key: 'saving', label: 'Saved' },
  { key: 'investment', label: 'Invested' },
  { key: 'reinvest', label: 'Back into the business' },
];

/**
 * Money.
 *
 * Everything here is optional, and blanks stay blank. A planning tool that
 * makes someone invent a savings figure to get past a form has taught them
 * that its numbers are fiction, and every number after that is discounted.
 *
 * The allocation suggestion is a rule of thumb, not advice.
 */
export default async function Money() {
  if (!(await currentUser())) redirect('/login');
  const today = toIso(new Date());
  const [rows, goals] = await Promise.all([moneyRows(150), allGoals()]);

  const in90 = rows.filter((r) => daysBetween(r.day, today) <= 90);
  const sum = (k: string, list = in90) => list.filter((r) => r.kind === k).reduce((a, r) => a + r.amount_gbp, 0);

  const income = sum('income');
  const expense = sum('expense');
  const saved = sum('saving');
  const invested = sum('investment');
  const reinvested = sum('reinvest');
  const net = income - expense;
  const has = rows.length > 0;

  const moneyGoals = goals.filter((g) => g.area === 'money' && g.status === 'active');

  return (
    <div className="wrap">
      <header className="mast">
        <div>
          <div className="greet">Last ninety days</div>
          <h1>Money</h1>
        </div>
      </header>

      {has ? (
        <div className="hero">
          <div className="lab">In, less out</div>
          <div className="big">
            £{Math.round(net).toLocaleString('en-GB')}
          </div>
          <p>
            £{Math.round(income).toLocaleString('en-GB')} in, £{Math.round(expense).toLocaleString('en-GB')} out,
            across {in90.length} entries.
          </p>
          <hr style={{ margin: '18px 0 14px' }} />
          <div className="row-stats">
            <div><div className="v">£{Math.round(saved).toLocaleString('en-GB')}</div><div className="n">Saved</div></div>
            <div><div className="v">£{Math.round(invested).toLocaleString('en-GB')}</div><div className="n">Invested</div></div>
            <div><div className="v">£{Math.round(reinvested).toLocaleString('en-GB')}</div><div className="n">Reinvested</div></div>
          </div>
        </div>
      ) : (
        <div className="card empty">
          <div className="ic">£</div>
          <b>Nothing logged</b>
          <p>
            Log what you actually know — a month of income, a few real expenses. Anything you are
            unsure of, leave out. Half a picture that is true beats a whole one that is guessed.
          </p>
        </div>
      )}

      {net > 0 && (
        <div className="card">
          <h2>A way to split it</h2>
          <p className="desc">
            A starting point, not advice, and not a rule you have to follow. Change any of it —
            the point is to have decided rather than to have drifted.
          </p>
          {[
            { label: 'Living and spending', pct: 50, why: 'Rent, food, fuel, the ordinary week.' },
            { label: 'Saving', pct: 20, why: 'Emergency fund first, then whatever it is for.' },
            { label: 'Back into the business', pct: 20, why: 'Ads, tools, anything that buys more of the £20k/month.' },
            { label: 'Investing', pct: 10, why: 'The slowest and the one you thank yourself for.' },
          ].map((s) => (
            <div key={s.label} className="bar-row">
              <span className="nm">{s.label}</span>
              <span className="bar-track"><i style={{ width: `${s.pct}%` }} /></span>
              <span className="vv">£{Math.round((net * s.pct) / 100).toLocaleString('en-GB')}</span>
            </div>
          ))}
          <p className="xs" style={{ marginTop: 10, marginBottom: 0 }}>
            Rules of thumb for planning. Not financial advice — I am not a financial adviser, and
            anything with tax or a mortgage in it is worth asking someone who is.
          </p>
        </div>
      )}

      {moneyGoals.length > 0 && (
        <div className="card">
          <h2>Saving towards</h2>
          {moneyGoals.map((g) => (
            <div key={g.id} className="goal-row">
              <div className="top">
                <b>{g.title}</b>
                <span className="pc">
                  {g.current_value != null && g.target_value
                    ? `${Math.round((g.current_value / g.target_value) * 100)}%`
                    : '—'}
                </span>
              </div>
              <div className="pbar money">
                <i style={{
                  width: g.current_value != null && g.target_value
                    ? `${Math.max(2, Math.min(100, (g.current_value / g.target_value) * 100))}%`
                    : '0%',
                }} />
              </div>
              <div className="xs" style={{ marginTop: 6 }}>
                {g.current_value != null
                  ? `£${g.current_value.toLocaleString('en-GB')}${g.target_value ? ` of £${g.target_value.toLocaleString('en-GB')}` : ''}`
                  : 'No target set. Put one on the Goals page and this fills in.'}
              </div>
            </div>
          ))}
        </div>
      )}

      <form action={saveMoneyAction} className="card">
        <h2>Add an entry</h2>
        <div className="grid2">
          <label className="f">
            <span className="lab">Date</span>
            <input type="date" name="day" required defaultValue={today} />
          </label>
          <label className="f">
            <span className="lab">Kind</span>
            <select name="kind" defaultValue="expense">
              {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
          </label>
        </div>
        <div className="grid2">
          <label className="f">
            <span className="lab">Amount £</span>
            <input type="number" step="any" name="amount_gbp" inputMode="decimal" required />
          </label>
          <label className="f">
            <span className="lab">Category</span>
            <input type="text" name="category" placeholder="RPM, fuel, ski kit" />
          </label>
        </div>
        <label className="f">
          <span className="lab">What it was</span>
          <input type="text" name="label" />
        </label>
        <button className="wide" type="submit">Save</button>
      </form>

      {has && (
        <div className="card">
          <h2>Entries</h2>
          <div className="scroll">
            <table>
              <thead><tr><th>Date</th><th>Kind</th><th>What</th><th>£</th><th /></tr></thead>
              <tbody>
                {rows.slice(0, 24).map((r) => (
                  <tr key={r.id}>
                    <td className="k">{fmt(r.day)}</td>
                    <td className="xs">{r.kind}</td>
                    <td className="xs">{r.label ?? r.category ?? '—'}</td>
                    <td>£{r.amount_gbp.toLocaleString('en-GB')}</td>
                    <td>
                      <form action={deleteMoneyAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="ghost sm" type="submit">×</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Nav active="/track" />
    </div>
  );
}

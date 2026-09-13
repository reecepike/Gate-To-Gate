import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { brandRows } from '@/lib/db';
import { toIso, fmt, daysBetween } from '@/lib/plan';
import { saveBrandAction } from '../../actions';
import Nav from '../../_components/Nav';
import { Ring } from '../../_components/Ring';

export const dynamic = 'force-dynamic';

export default async function Brand() {
  if (!(await currentUser())) redirect('/login');
  const today = toIso(new Date());
  const rows = await brandRows(60);

  const latest = rows[0] ?? null;
  const withFollowers = rows.filter((r) => r.followers != null);
  const current = withFollowers[0]?.followers ?? null;
  const first = withFollowers[withFollowers.length - 1]?.followers ?? null;
  const pct = current != null ? Math.round(Math.min(100, (current / 10000) * 100)) : null;

  const monthAgo = withFollowers.find((r) => daysBetween(r.day, today) >= 28);
  const growth = current != null && monthAgo?.followers != null ? current - monthAgo.followers : null;

  const daysSincePost = rows.find((r) => (r.posts ?? 0) > 0 || (r.reels ?? 0) > 0);
  const sincePost = daysSincePost ? daysBetween(daysSincePost.day, today) : null;

  const totalMinutes = rows.reduce((a, r) => a + (r.minutes ?? 0), 0);
  const totalLeads = rows.reduce((a, r) => a + (r.leads ?? 0), 0);
  const totalRevenue = rows.reduce((a, r) => a + (r.revenue_gbp ?? 0), 0);

  return (
    <div className="wrap">
      <header className="mast">
        <div>
          <div className="greet">Towards ten thousand</div>
          <h1>Personal brand</h1>
        </div>
      </header>

      <div className="hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Ring
            pct={pct}
            value={current == null ? '—' : current >= 1000 ? `${(current / 1000).toFixed(1)}k` : String(current)}
            label="followers"
            size={92}
            colour="var(--str)"
          />
          <div style={{ minWidth: 0 }}>
            <div className="lab">Followers</div>
            <h2 style={{ marginTop: 4 }}>
              {current == null ? 'Not tracked yet' : `${(10000 - current).toLocaleString('en-GB')} to go`}
            </h2>
            <p style={{ marginTop: 6 }}>
              {growth != null
                ? `${growth >= 0 ? '+' : ''}${growth.toLocaleString('en-GB')} in the last four weeks.`
                : 'Log a follower count twice a month and the trend does the rest.'}
            </p>
          </div>
        </div>
        {first != null && current != null && (
          <>
            <hr style={{ margin: '18px 0 14px' }} />
            <div className="row-stats">
              <div><div className="v">{(current - first).toLocaleString('en-GB')}</div><div className="n">Since you started</div></div>
              <div><div className="v">{Math.round(totalMinutes / 60)}h</div><div className="n">Creating</div></div>
              <div><div className="v">{totalLeads}</div><div className="n">Leads</div></div>
              <div><div className="v">£{Math.round(totalRevenue).toLocaleString('en-GB')}</div><div className="n">Revenue</div></div>
            </div>
          </>
        )}
      </div>

      {sincePost != null && sincePost >= 7 && (
        <div className="note warn">
          <b>Nothing posted for {sincePost} days.</b> This is the goal that dies quietly — it never
          feels urgent on any given day, and then a quarter has gone. An hour is enough.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card empty">
          <div className="ic">◈</div>
          <b>Nothing logged</b>
          <p>Followers and posts are the two that matter. Views, leads and revenue are worth having but only once the habit is there.</p>
        </div>
      ) : (
        <div className="card">
          <h2>History</h2>
          <div className="scroll">
            <table>
              <thead><tr><th>Date</th><th>Followers</th><th>Posts</th><th>Views</th><th>Leads</th></tr></thead>
              <tbody>
                {rows.slice(0, 16).map((r) => (
                  <tr key={r.day}>
                    <td className="k">{fmt(r.day)}</td>
                    <td>{r.followers?.toLocaleString('en-GB') ?? '—'}</td>
                    <td>{r.posts ?? '—'}</td>
                    <td>{r.views?.toLocaleString('en-GB') ?? '—'}</td>
                    <td>{r.leads ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <form action={saveBrandAction} className="card">
        <h2>Log today</h2>
        <p className="desc">Fill in what you know. Blanks stay blank rather than becoming zeros.</p>
        <label className="f">
          <span className="lab">Date</span>
          <input type="date" name="day" required defaultValue={today} />
        </label>
        <div className="grid2">
          <label className="f">
            <span className="lab">Followers</span>
            <input type="number" name="followers" inputMode="numeric" defaultValue={latest?.followers ?? ''} />
          </label>
          <label className="f">
            <span className="lab">Minutes creating</span>
            <input type="number" name="minutes" inputMode="numeric" />
          </label>
        </div>
        <div className="grid3">
          <label className="f"><span className="lab">Posts</span><input type="number" name="posts" inputMode="numeric" /></label>
          <label className="f"><span className="lab">Reels</span><input type="number" name="reels" inputMode="numeric" /></label>
          <label className="f"><span className="lab">Views</span><input type="number" name="views" inputMode="numeric" /></label>
        </div>
        <div className="grid3">
          <label className="f"><span className="lab">Engagement</span><input type="number" name="engagement" inputMode="numeric" /></label>
          <label className="f"><span className="lab">Leads</span><input type="number" name="leads" inputMode="numeric" /></label>
          <label className="f"><span className="lab">Revenue £</span><input type="number" step="any" name="revenue_gbp" inputMode="decimal" /></label>
        </div>
        <button className="wide" type="submit">Save</button>
      </form>

      <Nav active="/track" />
    </div>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import {
  skiRaces, runsForRaces, skiSessions, golfRounds, brandRows, moneyRows,
  recentSessions, recentLifts, allJobs, getSettings, recentReadiness, lsiRows, recentKnee,
} from '@/lib/db';
import { skiReadiness, behindPct, raceTotal } from '@/lib/ski';
import { rungFor } from '@/lib/knee';
import { toIso, fmt, daysBetween } from '@/lib/plan';
import { hmShort } from '@/lib/clock';
import Nav from '../_components/Nav';
import { Ring } from '../_components/Ring';

export const dynamic = 'force-dynamic';

/**
 * Track — the hub.
 *
 * One card per area, each showing the single number that matters and a way in.
 * Everything underneath is a normal logging page. The point of this screen is
 * to be scannable in about four seconds, not to be a dashboard.
 */
export default async function Track() {
  if (!(await currentUser())) redirect('/login');
  const today = toIso(new Date());

  const [races, sessions, golf, brand, money, gym, lifts, jobs, settings, readiness, lsi, knee] =
    await Promise.all([
      skiRaces(20), skiSessions(40), golfRounds(20), brandRows(30), moneyRows(60),
      recentSessions(30), recentLifts(40), allJobs(), getSettings(),
      recentReadiness(today, 14), lsiRows(10), recentKnee(today, 40),
    ]);

  const runs = await runsForRaces(races.map((r) => r.id));
  const rung = rungFor(today, knee);

  const recentBehind = races
    .map((r) => {
      const res = raceTotal(r.format, runs[r.id] ?? []);
      return behindPct(res.total ?? r.total_sec, r.winner_sec);
    })
    .filter((x): x is number => x != null);

  const in28 = (d: string) => daysBetween(d, today) <= 28 && daysBetween(d, today) >= 0;
  const in14 = (d: string) => daysBetween(d, today) <= 14 && daysBetween(d, today) >= 0;

  const ski = skiReadiness({
    gateSessions: sessions.filter((s) => in28(s.day) && s.kind === 'gates').length,
    technicalSessions: sessions.filter((s) => in28(s.day) && s.kind !== 'gates').length,
    confidence: meanOf(sessions.filter((s) => in28(s.day)).map((s) => s.confidence)),
    gymSessions14: gym.filter((s) => in14(s.day) && s.kind === 'gym' && s.completed).length,
    plyoRung: rung.rung,
    plyoSuspended: rung.suspended,
    lsi: lsi.length ? lsi[0].lsi : null,
    readiness14: meanOf(readiness.map((r) => r.score)),
    sleep14: meanOf(readiness.map((r) => r.sleep_h)),
    recentBehind,
  });

  const openJobs = jobs.filter((j) => j.status === 'todo' || j.status === 'doing');
  const openMin = openJobs.reduce((a, j) => a + Math.max(0, j.est_min - j.logged_min), 0);
  const legPress = lifts.filter((l) => /leg press/i.test(l.exercise)).sort((a, b) => (b.load_kg ?? 0) - (a.load_kg ?? 0))[0];
  const latestBrand = brand[0] ?? null;
  const latestGolf = golf.find((g) => g.handicap != null) ?? null;

  const income = money.filter((m) => m.kind === 'income').reduce((a, m) => a + m.amount_gbp, 0);
  const out = money.filter((m) => m.kind === 'expense').reduce((a, m) => a + m.amount_gbp, 0);

  return (
    <div className="wrap">
      <header className="mast">
        <div>
          <div className="greet">Where everything actually is</div>
          <h1>Track</h1>
        </div>
      </header>

      {/* ---------------------------------------------------------- skiing */}
      <div className="hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Ring
            pct={ski.score}
            value={ski.score == null ? '—' : String(ski.score)}
            label="ready"
            size={92}
            colour="var(--rust)"
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="lab">Ski readiness</div>
            <h2 style={{ marginTop: 4 }}>
              {ski.score == null ? 'Not enough logged' : ski.weakest ? `${ski.weakest} is the gap` : 'Balanced'}
            </h2>
            <p style={{ marginTop: 6 }}>{ski.recommendation}</p>
          </div>
        </div>
        {ski.score != null && (
          <>
            <hr style={{ margin: '18px 0 14px' }} />
            <div className="row-stats">
              {ski.parts.map((p) => (
                <div key={p.key}>
                  <div className="v">{p.value == null ? '—' : Math.round(p.value * 100)}</div>
                  <div className="n">{p.label}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Tile
        href="/track/ski"
        title="Ski racing"
        stat={races.length ? `${races.length} race${races.length === 1 ? '' : 's'} logged` : 'No races yet'}
        sub={
          races.length
            ? `Last: ${races[0].name}, ${fmt(races[0].day)}${settings.obarts_points != null ? ` · ${settings.obarts_points} O-Barts` : ''}`
            : 'Log a race and the readiness above starts including your actual form.'
        }
      />

      <Tile
        href="/gym"
        title="Gym"
        stat={legPress ? `${legPress.load_kg} kg leg press` : `${gym.filter((s) => in14(s.day) && s.completed).length} sessions in a fortnight`}
        sub={
          legPress
            ? `Best logged set. ${150 - (legPress.load_kg ?? 0) > 0 ? `${Math.round(150 - (legPress.load_kg ?? 0))} kg to the 150 target.` : 'Target passed — set a new one.'}`
            : 'Log a top set and the progression starts drawing itself.'
        }
      />

      <Tile
        href="/knee"
        title="The left leg"
        stat={`Rung ${rung.rung} of 4`}
        sub={rung.suspended ? 'Plyometric block suspended.' : lsi.length ? `Limb symmetry ${lsi[0].lsi}%.` : rung.spec.name}
      />

      <Tile
        href="/track/golf"
        title="Golf"
        stat={latestGolf?.handicap != null ? `${latestGolf.handicap} handicap` : golf.length ? `${golf.length} rounds` : 'No rounds yet'}
        sub={golf.length ? `Last played ${fmt(golf[0].day)}${golf[0].score ? `, round of ${golf[0].score}` : ''}.` : 'Score, course, date. That is all it needs.'}
      />

      <Tile
        href="/track/brand"
        title="Personal brand"
        stat={latestBrand?.followers != null ? `${latestBrand.followers.toLocaleString('en-GB')} followers` : 'Not tracked yet'}
        sub={
          latestBrand
            ? `Updated ${fmt(latestBrand.day)}${latestBrand.posts ? ` · ${latestBrand.posts} posts logged` : ''}.`
            : 'Followers, posts and time spent. The slowest goal and the easiest to let slide.'
        }
      />

      <Tile
        href="/work"
        title="Work"
        stat={`${hmShort(openMin)} open`}
        sub={`${openJobs.length} live job${openJobs.length === 1 ? '' : 's'}. The prioritiser decides what goes in the next slot.`}
      />

      <Tile
        href="/track/money"
        title="Money"
        stat={money.length ? `£${Math.round(income - out).toLocaleString('en-GB')} net logged` : 'Nothing logged'}
        sub={money.length ? `${money.length} entries. Blanks are fine; invented numbers are not.` : 'Income, expenses, savings and what they are for.'}
      />

      <Tile
        href="/progress"
        title="Trends"
        stat="Everything over time"
        sub="Bodyweight, readiness, training load and the block-by-block picture."
      />

      <Nav active="/track" />
    </div>
  );
}

function Tile({ href, title, stat, sub }: { href: string; title: string; stat: string; sub: string }) {
  return (
    <Link href={href} className="card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <h2>{title}</h2>
        <span className="num" style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 17 }}>{stat}</span>
      </div>
      <p className="xs" style={{ margin: '6px 0 0' }}>{sub}</p>
    </Link>
  );
}

function meanOf(xs: (number | null | undefined)[]): number | null {
  const v = xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

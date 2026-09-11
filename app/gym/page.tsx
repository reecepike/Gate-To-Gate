import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { recentKnee, recentLifts } from '@/lib/db';
import { context } from '@/lib/coach';
import { toIso, fmt, BLOCKS } from '@/lib/plan';
import { DAYS, VOLUME, LEFT_FIRST_RULE, daysInBlock } from '@/lib/gym';
import { rungFor } from '@/lib/knee';
import Nav from '../_components/Nav';
import Mast from '../_components/Mast';

export const dynamic = 'force-dynamic';

const DAYNAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default async function GymPage() {
  if (!(await currentUser())) redirect('/login');

  const day = toIso(new Date());
  const ctx = context(day);
  const [logs, lifts] = await Promise.all([recentKnee(day, 40), recentLifts(30)]);
  const rung = rungFor(day, logs);
  const live = daysInBlock(ctx.block);

  return (
    <div className="wrap">
      <Mast ctx={ctx} title="Gym" />

      <div className="note">
        <b>The rule that outranks everything else here.</b> {LEFT_FIRST_RULE}
      </div>

      <div className="note neutral">
        <b>Block {ctx.block.n} — {ctx.block.name}.</b> {ctx.block.gymDays} days a week · compounds at{' '}
        {ctx.block.compounds} · {ctx.block.isolation}
      </div>

      {DAYS.map((d) => {
        const inBlock = live.some((l) => l.key === d.key);
        return (
          <div className="card" key={d.key} style={inBlock ? undefined : { opacity: 0.55 }}>
            <h2>
              Day {d.n} — {d.title}
              {!inBlock && <span className="chip plain" style={{ marginLeft: 8 }}>Not in this block</span>}
            </h2>
            <p className="desc">
              {DAYNAMES[d.weekday - 1]} {d.time} · {d.minutes} min · {d.subtitle}
            </p>

            {d.warmup && <div className="note neutral"><b>Warm-up.</b> {d.warmup}</div>}

            <div className="scroll">
              <table>
                <thead><tr><th>Exercise</th><th style={{ width: 96 }}>Sets × reps</th></tr></thead>
                <tbody>
                  {d.exercises.map((e) => (
                    <tr key={e.name}>
                      <td className="k">
                        {e.name}
                        {e.left && <span className="chip key" style={{ marginLeft: 6 }}>Left first</span>}
                        {e.compound && <span className="chip plain" style={{ marginLeft: 6 }}>Block sets the load</span>}
                        {e.note && <div className="xs" style={{ fontWeight: 400, marginTop: 2 }}>{e.note}</div>}
                      </td>
                      <td className="mono">
                        {e.plyo ? `Rung ${rung.rung}` : e.compound ? ctx.block.compounds.split(',')[0] : e.sets}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {d.key === 'lowerB' && (
              <div className="note" style={{ marginTop: 12, marginBottom: 0 }}>
                <b>Plyometric block — Rung {rung.rung}, {rung.spec.name}.</b>{' '}
                {rung.spec.work.join(' · ')}
              </div>
            )}

            {d.tail && <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>{d.tail}</p>}
          </div>
        );
      })}

      {/* ------------------------------------------------------- volume */}
      <div className="card">
        <h2>Weekly volume check</h2>
        <p className="desc">
          The productive range for growth is roughly 10–20 hard sets per muscle group per week. Below ten you are
          maintaining; much above twenty you are mostly accumulating fatigue.
        </p>
        <div className="scroll">
          <table>
            <thead><tr><th>Muscle</th><th>Sets</th><th>Days</th><th>Verdict</th></tr></thead>
            <tbody>
              {VOLUME.map((v) => (
                <tr key={v.muscle}>
                  <td className="k">{v.muscle}</td>
                  <td>{v.sets}</td>
                  <td>{v.days}</td>
                  <td className="xs">{v.verdict}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="note" style={{ marginTop: 14, marginBottom: 0 }}>
          <b>The honest caution.</b> Five lifts, one gates session and two rounds of golf is eight training touches a
          week on a leg rebuilt eighteen months ago. It is only sustainable because Thursday is genuinely light and
          Sunday is genuinely off. Golf is the flex variable, and Day 5 is the first thing to drop in a race week. If the
          weekly swelling grade creeps to 1+ twice running, cut a day rather than pushing through.
        </div>
      </div>

      {/* ----------------------------------------------- block progression */}
      <div className="card">
        <h2>How the numbers move across blocks</h2>
        <div className="scroll">
          <table>
            <thead><tr><th>Block</th><th>Days</th><th>Compounds</th><th>Isolation</th></tr></thead>
            <tbody>
              {BLOCKS.map((b) => (
                <tr key={b.n} style={b.n === ctx.block.n ? { background: 'var(--rust-soft)' } : undefined}>
                  <td className="k">{b.n} — {b.short}</td>
                  <td>{b.gymDays}</td>
                  <td className="xs">{b.compounds}</td>
                  <td className="xs">{b.isolation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="xs" style={{ marginTop: 10, marginBottom: 0 }}>
          Percentages are a guide, not a religion. Judge every top set by whether you had two clean reps left. Note that
          the isolation work barely changes across the first four blocks — lateral raises do not need periodising, they
          need doing. It is the compounds that cycle.
        </p>
      </div>

      {/* -------------------------------------------------------- lifts */}
      {lifts.length > 0 && (
        <div className="card">
          <h2>Recent top sets</h2>
          <div className="scroll">
            <table>
              <thead><tr><th>Date</th><th>Exercise</th><th>Load</th><th>Reps</th><th>Side</th></tr></thead>
              <tbody>
                {lifts.map((l) => (
                  <tr key={l.id}>
                    <td className="mono xs">{fmt(l.day)}</td>
                    <td className="k">{l.exercise}</td>
                    <td>{l.load_kg ?? '—'}{l.load_kg ? ' kg' : ''}</td>
                    <td>{l.sets ? `${l.sets}×` : ''}{l.reps ?? '—'}</td>
                    <td className="xs">{l.side ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Nav active="/reference" />
    </div>
  );
}

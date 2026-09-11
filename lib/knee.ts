/**
 * The left leg. ACL reconstruction + meniscus repair + LET, 4 September 2025.
 *
 * Two rules drive everything here and both are conservative on purpose:
 *   1. The plyometric rung is the LOWER of what the block allows and what the
 *      graft's age allows. A block never promotes a leg the calendar hasn't.
 *   2. Swelling in the 24 h after a plyo session drops you a rung for two weeks.
 *      No exceptions, no negotiating — it is the only warning you get.
 */

import { BLOCKS, blockFor, daysBetween, monthsPostOp, addDays } from './plan';

export type Rung = 1 | 2 | 3 | 4;

export type RungSpec = {
  n: Rung;
  name: string;
  months: string;
  why: string;
  work: string[];
};

export const LADDER: RungSpec[] = [
  {
    n: 1, name: 'Absorb', months: '12 – 14',
    why: 'Landing and deceleration only. The graft handles controlled load well, but you have been back in gates barely two months.',
    work: ['Double-leg pogos 3×10', 'Box step-downs 3×8 / side, 3 s lower', 'Drop-to-stick from 20 cm, 4×5 — land, freeze, hold three seconds'],
  },
  {
    n: 2, name: 'Produce', months: '14 – 15.5',
    why: 'Force production, still sticking every landing. Comfortably past the point where most protocols clear jumping.',
    work: ['Split jumps 4×6', 'Single-leg box jumps 4×4 / side — up only, step down', 'Lateral bound to stick 4×4 / side'],
  },
  {
    n: 3, name: 'React', months: '15.5 – 18.3',
    why: 'Low depth jumps and continuous hops. Well into remodelling. The natural point for the one-off physio screening.',
    work: ['Continuous lateral bounds 4×6 / side', 'Single-leg continuous hops 4×5 / side', 'Low depth jumps from 30 cm, 5×3'],
  },
  {
    n: 4, name: 'Race', months: '18.3 – 22.6',
    why: '40 cm depth jumps and repeated lateral bounds — the highest-force work in the plan, and it does not start until eighteen months out.',
    work: ['Skater bounds for distance 5×5', 'Depth jumps 40 cm, 5×3', 'Repeated lateral hurdle hops — 6 contacts, 4 sets'],
  },
];

/** What the graft's age alone would allow. */
export function rungByAge(iso: string): Rung {
  const m = monthsPostOp(iso);
  if (m < 14) return 1;
  if (m < 15.5) return 2;
  if (m < 18.3) return 3;
  return 4;
}

export type KneeLog = {
  day: string;
  swelling: 0 | 1 | 2 | 3 | null;   // zero / trace / 1+ / 2+
  pain: number | null;              // 0–10
  flexion_ok: boolean;
  knee10: boolean;
  plyo_done: boolean;
  notes: string | null;
};

export type RungVerdict = {
  rung: Rung;
  spec: RungSpec;
  ceiling: Rung;        // what block + graft age would permit
  demoted: boolean;
  demotedUntil: string | null;
  /** True when the stop rule fired and there is no lower rung to drop to. */
  suspended: boolean;
  reason: string;
};

/**
 * The working rung, after the stop rule has had its say.
 *
 * `logs` should be the knee log, newest first, covering at least the last month.
 */
export function rungFor(iso: string, logs: KneeLog[]): RungVerdict {
  const block = blockFor(iso);
  const ceiling = Math.min(block.rung, rungByAge(iso)) as Rung;

  // The stop rule: swelling (trace or worse) within 24 h of a plyo session.
  let demotedUntil: string | null = null;
  for (const l of logs) {
    if (l.day > iso) continue;
    if (daysBetween(l.day, iso) > 21) break;
    if ((l.swelling ?? 0) < 1) continue;
    // Was there a plyo session on that day or the day before?
    const plyo = logs.some(
      (p) => p.plyo_done && (p.day === l.day || p.day === addDays(l.day, -1)),
    );
    if (!plyo) continue;
    const until = addDays(l.day, 14);
    if (until > iso && (!demotedUntil || until > demotedUntil)) demotedUntil = until;
  }

  const rung = (demotedUntil ? Math.max(1, ceiling - 1) : ceiling) as Rung;
  const spec = LADDER[rung - 1];
  const suspended = !!demotedUntil && ceiling === 1;

  let reason: string;
  if (suspended) {
    reason = `You swelled inside 24 h of a plyo session, and there is no rung below this one — so the block comes out entirely until ${demotedUntil}. Landing mechanics and the Knee 10, nothing that leaves the floor.`;
  } else if (demotedUntil) {
    reason = `Held a rung down until ${demotedUntil} — you swelled inside 24 h of a plyo session. This is the stop rule and it does not negotiate.`;
  } else if (block.rung < rungByAge(iso)) {
    reason = `Block ${block.n} caps you here. The graft would take more; the training plan does not need it yet.`;
  } else if (rungByAge(iso) < block.rung) {
    reason = `The graft caps you here — ${monthsPostOp(iso).toFixed(1)} months post-op. The block would allow Rung ${block.rung}; the calendar says wait.`;
  } else {
    reason = 'Block and graft age agree. This is the right rung.';
  }

  return { rung, spec, ceiling, demoted: !!demotedUntil, demotedUntil, suspended, reason };
}

/* ------------------------------------------------------------- knee 10 */

export const KNEE10: { move: string; dose: string; why: string }[] = [
  { move: 'Knee flexion ROM — heel slide to end range, hold', dose: '10×10 s', why: 'LET reconstructions commonly leave a touch of end-range stiffness. Losing deep flexion quietly costs you a low, forward slalom stance.' },
  { move: 'Terminal knee extension', dose: '2×15', why: 'Full extension and VMO tone. Never let the leg sit in a soft-lock.' },
  { move: 'Seated calf raise', dose: '2×20', why: 'Soleus. Directly resists the shear force the graft takes.' },
  { move: 'Copenhagen hold', dose: '2×20 s / side', why: 'Adductor and medial knee support — the meniscus repair’s friend.' },
  { move: 'Hip airplane', dose: '6 / side', why: 'Controlled rotation over a stable knee. LET limits tibial rotation, so the hip must supply it.' },
  { move: 'Single-leg balance, eyes shut', dose: '3×30 s / side', why: 'Proprioception. Cheap, and it degrades faster than strength does.' },
];

/* ------------------------------------------------- monitoring thresholds */

export const SWELLING: { grade: 0 | 1 | 2 | 3; label: string; sees: string; act: string; band: 'green' | 'amber' | 'red' }[] = [
  { grade: 0, label: 'Zero', sees: 'No wave returns', act: 'Nothing. Carry on, progress as planned.', band: 'green' },
  { grade: 1, label: 'Trace', sees: 'A small wave after a few seconds', act: 'Normal after a hard week. Note it. Two in a row means hold your loads.', band: 'amber' },
  { grade: 2, label: '1+', sees: 'Wave returns quickly and clearly', act: 'Drop back one plyo rung, cut gym volume 30% for a week. Keep skiing.', band: 'amber' },
  { grade: 3, label: '2+', sees: 'Visible swelling, hollow stays full', act: 'Stop plyometrics. Pool and bike only for a week. If it has not settled in 72 h, get it seen.', band: 'red' },
];

export const RED_FLAGS = [
  'True giving-way, or the knee buckling under you',
  'Locking, or a block that stops the leg going fully straight',
  'Swelling that has not settled after 72 hours',
  'New pain on the outside of the knee, where the LET was done',
  'Pain that wakes you at night',
];

export type LsiTest = { key: string; name: string; protocol: string; target: string };

export const LSI_TESTS: LsiTest[] = [
  { key: 'cmj', name: 'Single-leg countermovement jump', protocol: '3 each leg, best of 3', target: '>95% by Dec, >98% by Mar' },
  { key: 'hop', name: 'Single-leg hop for distance', protocol: '3 each leg, best of 3', target: '>95% by Dec' },
  { key: 'crossover', name: 'Triple crossover hop', protocol: '3 each leg', target: '>90% — the rotational one, expect it to lag' },
  { key: 'wallsit', name: 'Single-leg wall sit', protocol: 'Hold to failure, each leg', target: '>90% — the endurance quality a full course needs' },
];

/** LSI target for a given date — 95% by 20 Dec, 98% by 7 Mar, then held. */
export function lsiTarget(iso: string): number {
  if (iso < '2026-12-20') return 90;
  if (iso < '2027-03-07') return 95;
  return 98;
}

/**
 * The knee verdict for today, from the recent log. This is the thing that is
 * allowed to override a training day.
 */
export type KneeVerdict = {
  band: 'green' | 'amber' | 'red';
  line: string;
  detail: string | null;
};

export function kneeVerdict(iso: string, logs: KneeLog[]): KneeVerdict {
  const recent = logs.filter((l) => l.day <= iso && daysBetween(l.day, iso) <= 21);
  const last = recent[0] ?? null;

  if (!last) {
    return { band: 'amber', line: 'No knee data logged', detail: 'Two minutes on a Thursday is the whole monitoring system. Without it I am guessing, which is exactly what you did not want.' };
  }

  const sw = last.swelling ?? 0;
  const pain = last.pain ?? 0;

  if (sw >= 3 || pain > 5) {
    return {
      band: 'red',
      line: sw >= 3 ? 'Effusion — stop the plyometrics' : `Pain ${pain}/10 — stop the plyo and heavy unilateral work`,
      detail: 'Pool and bike only for a week. If it has not settled in 72 hours, get it seen — that is a clinician’s job, not mine.',
    };
  }

  const twoTrace = recent.length >= 2 && (recent[0].swelling ?? 0) >= 1 && (recent[1].swelling ?? 0) >= 1;

  if (sw === 2 || pain >= 4 || twoTrace) {
    return {
      band: 'amber',
      line: sw === 2 ? 'Grade 1+ swelling — drop a rung, cut gym volume 30%' : twoTrace ? 'Trace swelling two checks running — hold your loads' : `Pain ${pain}/10 — hold at current load`,
      detail: 'No progression for two weeks, then reassess. Keep skiing — skill work is what you protect last.',
    };
  }

  if (sw === 1) {
    return { band: 'green', line: 'Trace swelling — normal after a hard week', detail: 'Noted. Two in a row and we hold the loads.' };
  }

  return { band: 'green', line: 'Knee quiet', detail: null };
}

/** Which block a given rung first becomes available in — for the Knee page. */
export function rungBlocks(r: Rung): string {
  const bs = BLOCKS.filter((b) => b.rung === r);
  if (!bs.length) return '';
  return bs.length === 1
    ? `Block ${bs[0].n} · ${bs[0].from} – ${bs[0].to}`
    : `Blocks ${bs[0].n}–${bs[bs.length - 1].n} · to ${bs[bs.length - 1].to}`;
}

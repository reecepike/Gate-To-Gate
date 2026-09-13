/**
 * The Today Score.
 *
 * One number, out of a hundred, answering a single question: did you execute
 * today well? Not "were you busy", and emphatically not "how many boxes did you
 * tick" — a scoring system that rewards volume will, given a few weeks, teach
 * you to do more of the wrong things and feel good about it.
 *
 * So the design rule is that the score measures ALIGNMENT, not output:
 *
 *   - A red readiness morning where you rested scores full marks on recovery.
 *     Choosing not to train, correctly, is execution.
 *   - Twelve hours of work scores WORSE than seven, unless a real deadline
 *     forced it. Overload is a failure mode, not an achievement.
 *   - Finishing the one job that mattered beats finishing four that did not.
 *   - Taking your free time counts. Skipping it costs you.
 *
 * And when there is not enough information to say anything honest, it says so
 * rather than producing a number. A confident 71 built out of three unknowns is
 * worse than "not enough logged yet" — you would believe it.
 */

import type { Verdict } from './readiness';
import type { Block, DayPlan } from './planner';
import { hm } from './clock';

export type Part = {
  key: string;
  label: string;
  weight: number;
  /** 0–1, or null when there is nothing to judge it on. */
  value: number | null;
  note: string;
};

export type DayScore = {
  score: number | null;
  band: 'green' | 'amber' | 'red' | null;
  parts: Part[];
  confidence: 'full' | 'partial' | 'insufficient';
  headline: string;
  detail: string;
  /** What would have made today better, at most two things. */
  lessons: string[];
};

export type ScoreInputs = {
  day: string;
  readiness: Verdict | null;
  plan: DayPlan | null;
  /** Blocks as they actually ended up — done, skipped or untouched. */
  blocks: Block[];
  /** Minutes of training actually logged today. */
  trainedMin: number;
  /** Minutes of work actually logged today. */
  workedMin: number;
  kneeDone: boolean;
  workCapH: number;
  freeFloorMin: number;
  sleepH: number | null;
  sleepTargetH: number;
  /** Goals touched by anything completed today. */
  goalsTouched: number;
  /** True when the day is finished — before that the score is provisional. */
  dayOver: boolean;
};

const W = {
  recovery: 25,
  sleep: 20,
  rightWork: 20,
  balance: 20,
  goals: 15,
};

function clamp(x: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, x));
}

export function scoreDay(i: ScoreInputs): DayScore {
  const parts: Part[] = [];

  /* ---------------------------------------- 1. did training match readiness? */
  {
    const band = i.readiness?.band ?? null;
    const planned = i.plan?.trainMinutes ?? 0;
    let value: number | null = null;
    let note = 'No check-in, so there is nothing to judge the training decision against.';

    if (band) {
      if (band === 'red') {
        value = i.trainedMin <= 30 ? 1 : i.trainedMin <= 60 ? 0.6 : 0.2;
        note = i.trainedMin <= 30
          ? 'Readiness was red and you rested. That is the right call and it scores as one — this is the part of the system most people get backwards.'
          : `Readiness was red and you trained ${hm(i.trainedMin)} anyway. The session was not the problem; doing it today was.`;
      } else if (band === 'amber') {
        value = i.trainedMin === 0 ? 0.55 : clamp(i.trainedMin / Math.max(planned, 30)) * 0.5 + 0.5;
        note = i.trainedMin === 0
          ? 'Amber was a trim-it day, not a skip-it day. Not a disaster, but the session was affordable.'
          : 'Trained on an amber day. Keeping the movements and losing the top set is exactly the right response.';
      } else {
        value = planned === 0
          ? 1
          : i.trainedMin >= planned * 0.8 ? 1 : i.trainedMin > 0 ? 0.7 : 0.35;
        note = planned === 0
          ? 'Nothing was scheduled and nothing was needed.'
          : i.trainedMin >= planned * 0.8
            ? 'Green morning, session done. That is what a green day is for.'
            : 'Readiness was good and the session did not happen. Green days are the ones you cannot afford to waste.';
      }
    }
    parts.push({ key: 'recovery', label: 'Training matched recovery', weight: W.recovery, value, note });
  }

  /* -------------------------------------------------------------- 2. sleep */
  {
    let value: number | null = null;
    let note = 'No sleep logged.';
    if (i.sleepH != null) {
      const dev = i.sleepH - i.sleepTargetH;
      // Short is penalised hard; long is barely penalised at all.
      value = dev >= 0 ? clamp(1 - dev / 6, 0.85, 1) : clamp(1 + dev / 2.5);
      note = dev >= -0.25
        ? `${i.sleepH.toFixed(1)} h against a ${i.sleepTargetH.toFixed(2)} h target. The whole build rests on this number.`
        : `${i.sleepH.toFixed(1)} h — ${Math.abs(dev).toFixed(1)} h short. It shows up two days later, not today.`;
    }
    parts.push({ key: 'sleep', label: 'Sleep', weight: W.sleep, value, note });
  }

  /* -------------------------------------------- 3. the RIGHT work, not the most */
  {
    const workBlocks = i.blocks.filter((b) => b.kind === 'work' || b.kind === 'own');
    let value: number | null = null;
    let note = 'No work was planned today.';

    if (workBlocks.length) {
      // The first work block of the day is the one the planner considered most
      // important. Completing it is worth more than completing three later ones.
      const ordered = [...workBlocks].sort((a, b) => a.start - b.start);
      const top = ordered[0];
      const done = workBlocks.filter((b) => b.status === 'done');
      const doneMin = done.reduce((a, b) => a + (b.end - b.start), 0);
      const allMin = workBlocks.reduce((a, b) => a + (b.end - b.start), 0);

      const topDone = top.status === 'done' ? 1 : 0;
      const rest = allMin > 0 ? doneMin / allMin : 0;
      value = clamp(topDone * 0.6 + rest * 0.4);
      note = topDone
        ? `The first block — ${top.title} — got done. That is the one that counts; the rest is bonus.`
        : `${top.title} was the priority and it did not happen. ${done.length ? 'Other work did, which is not the same thing.' : ''}`;
    } else if (i.workedMin > 0) {
      value = 0.8;
      note = `${hm(i.workedMin)} logged against nothing planned. Fine, but the planner cannot tell whether it was the right work.`;
    }
    parts.push({ key: 'work', label: 'The work that mattered', weight: W.rightWork, value, note });
  }

  /* ------------------------------------------------------------ 4. balance */
  {
    const cap = i.workCapH * 60;
    const bits: number[] = [];
    const notes: string[] = [];

    // Overload is a penalty, not a bonus. This is the clause that stops the
    // score becoming a productivity leaderboard.
    if (i.workedMin > 0 || i.plan) {
      const over = i.workedMin - cap;
      const v = over <= 0 ? 1 : clamp(1 - over / 180, 0.2, 1);
      bits.push(v);
      if (over > 30) notes.push(`${hm(over)} past your ${i.workCapH} h line.`);
    }

    const free = i.plan?.freeMinutes ?? null;
    if (free != null) {
      bits.push(clamp(free / Math.max(1, i.freeFloorMin)));
      if (free < i.freeFloorMin) notes.push(`only ${hm(free)} of unstructured time.`);
    }

    bits.push(i.kneeDone ? 1 : 0.45);
    if (!i.kneeDone) notes.push('Knee 10 not done.');

    const value = bits.length ? bits.reduce((a, b) => a + b, 0) / bits.length : null;
    parts.push({
      key: 'balance',
      label: 'Balance and load',
      weight: W.balance,
      value,
      note: notes.length
        ? notes.join(' ')
        : 'Work inside its limits, free time taken, knee done. A sustainable shape of day.',
    });
  }

  /* ------------------------------------------------- 5. goal contribution */
  {
    const value = i.goalsTouched > 0 ? clamp(0.6 + i.goalsTouched * 0.2) : 0.25;
    parts.push({
      key: 'goals',
      label: 'Moved something long-term',
      weight: W.goals,
      value,
      note: i.goalsTouched > 0
        ? `${i.goalsTouched} goal${i.goalsTouched === 1 ? '' : 's'} got touched today. Days that move nothing long-term are the ones that vanish.`
        : 'Nothing today moved a long-term goal. One day is nothing; a fortnight of them is how a year goes missing.',
    });
  }

  /* ------------------------------------------------------------ the total */

  const known = parts.filter((p) => p.value !== null);
  const knownWeight = known.reduce((a, p) => a + p.weight, 0);
  const totalWeight = parts.reduce((a, p) => a + p.weight, 0);

  // Below half the weight there is not enough to say anything honest.
  if (knownWeight < totalWeight * 0.5) {
    return {
      score: null,
      band: null,
      parts,
      confidence: 'insufficient',
      headline: 'Not enough logged to score today',
      detail:
        'A number here would be made up. Do the morning check-in and mark a couple of blocks off as you go, and the score becomes worth reading — until then it would just be a confident guess.',
      lessons: [],
    };
  }

  const score = Math.round((known.reduce((a, p) => a + (p.value ?? 0) * p.weight, 0) / knownWeight) * 100);
  const band: 'green' | 'amber' | 'red' = score >= 75 ? 'green' : score >= 55 ? 'amber' : 'red';
  const confidence: DayScore['confidence'] = knownWeight >= totalWeight * 0.85 ? 'full' : 'partial';

  const weakest = [...known].sort((a, b) => (a.value ?? 1) * a.weight - (b.value ?? 1) * b.weight);
  const lessons = weakest.filter((p) => (p.value ?? 1) < 0.7).slice(0, 2).map((p) => p.note);

  const headline = !i.dayOver
    ? `${score} so far`
    : band === 'green' ? `${score} — a good day`
      : band === 'amber' ? `${score} — a mixed day`
        : `${score} — a poor day`;

  const detail = !i.dayOver
    ? 'Provisional. It moves as you tick things off, and it settles tonight.'
    : band === 'green'
      ? 'The shape was right: what mattered got done, the training matched the recovery, and the day did not eat itself.'
      : band === 'amber'
        ? 'Parts of it worked. The breakdown below shows which part cost you, and it is usually one thing rather than five.'
        : 'Worth reading the breakdown rather than the number. One bad day decides nothing; the same bad day four times is a system problem.';

  return { score, band, parts, confidence, headline, detail, lessons };
}

/** The seven-day trend, for the little sparkline under the number. */
export function trend(scores: { day: string; score: number | null }[]): {
  avg: number | null;
  delta: number | null;
  points: number[];
} {
  const vals = scores.map((s) => s.score).filter((x): x is number => x != null);
  if (!vals.length) return { avg: null, delta: null, points: [] };
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const half = Math.floor(vals.length / 2);
  const recent = vals.slice(0, half || 1);
  const older = vals.slice(half || 1);
  const delta = older.length
    ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length - older.reduce((a, b) => a + b, 0) / older.length)
    : null;
  return { avg, delta, points: [...vals].reverse() };
}

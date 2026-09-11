/**
 * Daily readiness, scored against your own rolling baseline rather than against
 * a population. An RHR of 54 means nothing on its own; 54 when your fortnight
 * has been running at 47 means a great deal.
 *
 * The trend outranks any single day. One bad morning is a bad morning.
 */

import { daysBetween } from './plan';

export type Readiness = {
  day: string;
  sleep_h: number | null;
  sleep_q: number | null;       // 1 poor – 5 excellent
  rhr: number | null;
  weight_kg: number | null;
  legs: number | null;          // 1 wrecked – 5 fresh
  stress: number | null;        // 1 calm – 5 fried
  motivation: number | null;    // 1 flat – 5 keen
  work_load: number | null;     // 1 quiet – 5 buried  (RPM + own businesses)
  illness: boolean;
  notes: string | null;
  score: number | null;
  band: 'green' | 'amber' | 'red' | null;
};

export type Verdict = {
  score: number;
  band: 'green' | 'amber' | 'red';
  headline: string;
  drivers: string[];
  /** What today's training should actually do. */
  action: string;
};

function mean(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** 0–1 from a 1–5 scale, where 5 is good. */
function fromScale(v: number | null, invert = false): number | null {
  if (v === null) return null;
  const n = (clamp(v, 1, 5) - 1) / 4;
  return invert ? 1 - n : n;
}

export function assess(today: Readiness, history: Readiness[]): Verdict {
  const past = history.filter((r) => r.day < today.day && daysBetween(r.day, today.day) <= 21).slice(0, 14);

  const parts: { key: string; weight: number; value: number; note: string | null }[] = [];

  /* sleep — 25 */
  {
    const base = mean(past.map((r) => r.sleep_h ?? NaN)) ?? 8.4;
    const h = today.sleep_h;
    const q = fromScale(today.sleep_q);
    let v = 0.6;
    let note: string | null = null;
    if (h !== null) {
      // 8.4 h is the plan's average and the input the whole build rests on.
      const dev = h - Math.max(base, 7.5);
      v = clamp(0.75 + dev * 0.25, 0, 1);
      if (h < 6.5) note = `${h} h — short. The seven kilos are built in bed, not in the gym.`;
      else if (h >= 8.5) note = `${h} h — that is the input that makes the rest work.`;
    }
    if (q !== null) v = v * 0.7 + q * 0.3;
    parts.push({ key: 'Sleep', weight: 25, value: v, note });
  }

  /* resting heart rate — 20 */
  {
    const base = mean(past.map((r) => r.rhr ?? NaN));
    let v = 0.7;
    let note: string | null = null;
    if (today.rhr !== null && base !== null) {
      const dev = today.rhr - base;
      v = clamp(1 - dev / 12, 0, 1);
      if (dev >= 7) note = `RHR +${dev.toFixed(0)} on your fortnight. One morning is noise; three in a row is a week to pull back.`;
      else if (dev <= -3) note = `RHR ${dev.toFixed(0)} on baseline — well recovered.`;
    } else if (today.rhr !== null) {
      v = 0.7;
    }
    parts.push({ key: 'RHR', weight: 20, value: v, note });
  }

  /* legs — 20 */
  {
    const v = fromScale(today.legs) ?? 0.65;
    const note = (today.legs ?? 5) <= 2 ? 'Legs are flat. Wednesday needs them more than Monday does.' : null;
    parts.push({ key: 'Legs', weight: 20, value: v, note });
  }

  /* stress + work load — 15 */
  {
    const s = fromScale(today.stress, true);
    const w = fromScale(today.work_load, true);
    const v = mean([s, w].filter((x): x is number => x !== null)) ?? 0.65;
    const note = (today.stress ?? 1) >= 4 || (today.work_load ?? 1) >= 5
      ? 'Work is loud today. Training load and life load draw on the same account.'
      : null;
    parts.push({ key: 'Stress & work', weight: 15, value: v, note });
  }

  /* motivation — 10 */
  {
    const v = fromScale(today.motivation) ?? 0.65;
    const note = (today.motivation ?? 5) <= 2 ? 'Flat. Worth noticing when it lasts more than two days — that is fatigue, not character.' : null;
    parts.push({ key: 'Motivation', weight: 10, value: v, note });
  }

  /* bodyweight trend — 10 */
  {
    const base = mean(past.map((r) => r.weight_kg ?? NaN));
    let v = 0.7;
    let note: string | null = null;
    if (today.weight_kg !== null && base !== null) {
      const dev = today.weight_kg - base;
      // Losing weight on a mass block is the problem, not gaining it.
      v = dev >= 0 ? 0.85 : clamp(0.85 + dev * 0.6, 0, 1);
      if (dev <= -0.8) note = `Down ${Math.abs(dev).toFixed(1)} kg on your fortnight. On this block that is under-eating, not over-training.`;
    }
    parts.push({ key: 'Bodyweight', weight: 10, value: v, note });
  }

  const totalW = parts.reduce((a, p) => a + p.weight, 0);
  let score = Math.round(parts.reduce((a, p) => a + p.value * p.weight, 0) / totalW * 100);

  let band: 'green' | 'amber' | 'red' = score >= 75 ? 'green' : score >= 55 ? 'amber' : 'red';

  const drivers = parts.filter((p) => p.note).map((p) => p.note!) as string[];

  /* hard overrides — these outrank the arithmetic */
  if (today.illness) {
    band = 'red';
    score = Math.min(score, 40);
    drivers.unshift('Unwell. Nothing above the neck rule survives contact with a rebuilt knee and a Wednesday drive — rest.');
  } else {
    const rhrBase = mean(past.map((r) => r.rhr ?? NaN));
    const streak = rhrBase !== null
      && [today, ...past].slice(0, 3).every((r) => r.rhr !== null && r.rhr - rhrBase >= 7)
      && past.length >= 5;
    if (streak) {
      band = 'red';
      drivers.unshift('RHR up 7+ bpm three mornings running. That is one of the five pull-back triggers.');
    } else if (today.sleep_h !== null && today.sleep_h < 5.5 && band === 'green') {
      band = 'amber';
      drivers.unshift('Under 5.5 h. Keep the session, lose the top set.');
    }
  }

  const headline =
    band === 'green' ? 'Good to go' : band === 'amber' ? 'Train, but trim it' : 'Back off today';

  const action =
    band === 'green'
      ? 'Run the session as written. If it is a plyo day, this is the day to progress it.'
      : band === 'amber'
        ? 'Keep every movement, cut one set from each and 10% off the bar. Do not touch the plyo progression today.'
        : 'No plyometrics and no heavy unilateral work. Knee 10, a walk, the sauna, and an early night. Skill work is what you protect last — if it is Wednesday, still go, and ski to feel.';

  return { score, band, headline, drivers, action };
}

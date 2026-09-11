/**
 * Where the four engines meet.
 *
 * Each one — readiness, knee, gym, work — has its own opinion. This decides
 * which opinion wins today, because a page that shows you five equally weighted
 * things is a page you stop reading by Wednesday.
 */

import { Block, blockFor, weekFor, daysBetween, monthsPostOp, nextAnything, raceThisWeek, targetWeight, Race, CHAMPS } from './plan';
import { GymDay, gymDayOn, prescribe, Prescribed } from './gym';
import { KneeLog, KneeVerdict, kneeVerdict, rungFor, RungVerdict } from './knee';
import { Readiness, Verdict, assess } from './readiness';
import { Job, Queues, WorkVerdict, NextUp, queues, workVerdict, nextUp } from './work';
import { DayPlan, dayPlan } from './week';
import { WorkSlot, DEFAULT_SLOTS } from './week';

export type Context = {
  day: string;
  week: number;
  block: Block;
  daysToChamps: number;
  monthsPostOp: number;
  nextEvent: Race | null;
  daysToNext: number | null;
  raceWeek: Race | null;
  targetWeight: number;
  plan: DayPlan;
  gym: GymDay | null;
};

export function context(iso: string): Context {
  const ev = nextAnything(iso);
  return {
    day: iso,
    week: weekFor(iso),
    block: blockFor(iso),
    daysToChamps: Math.max(0, daysBetween(iso, CHAMPS)),
    monthsPostOp: monthsPostOp(iso),
    nextEvent: ev,
    daysToNext: ev ? daysBetween(iso, ev.day) : null,
    raceWeek: raceThisWeek(iso),
    targetWeight: targetWeight(iso),
    plan: dayPlan(iso),
    gym: gymDayOn(iso),
  };
}

export type Brief = {
  ctx: Context;
  readiness: Verdict | null;
  knee: KneeVerdict;
  rung: RungVerdict;
  session: Prescribed | null;
  q: Queues;
  work: WorkVerdict;
  next: NextUp;
  /** The single line at the top of the page. */
  headline: string;
  sub: string;
  band: 'green' | 'amber' | 'red';
};

export function brief(
  iso: string,
  data: {
    today: Readiness | null;
    history: Readiness[];
    kneeLogs: KneeLog[];
    jobs: Job[];
    slots?: WorkSlot[];
  },
): Brief {
  const ctx = context(iso);
  const slots = data.slots?.length ? data.slots : DEFAULT_SLOTS;

  const readiness = data.today ? assess(data.today, data.history) : null;
  const knee = kneeVerdict(iso, data.kneeLogs);
  const rung = rungFor(iso, data.kneeLogs);
  const session = ctx.gym ? prescribe(iso, ctx.gym, rung.rung, rung.suspended) : null;

  const q = queues(data.jobs, iso, slots);
  const work = workVerdict(q, iso, slots);
  const next = nextUp(q, iso, slots);

  /* Which voice wins today, in order of what can actually hurt you. */
  let headline: string;
  let sub: string;
  let band: 'green' | 'amber' | 'red';

  if (knee.band === 'red') {
    band = 'red';
    headline = knee.line;
    sub = knee.detail ?? 'The leg outranks the plan. Always.';
  } else if (readiness?.band === 'red') {
    band = 'red';
    headline = readiness.headline;
    sub = readiness.action;
  } else if (!readiness) {
    band = 'amber';
    headline = 'No check-in yet';
    sub = 'Thirty seconds of numbers is what lets the rest of this page say anything useful. Fill it in below.';
  } else if (knee.band === 'amber') {
    band = 'amber';
    headline = knee.line;
    sub = knee.detail ?? 'Hold the loads where they are.';
  } else if (readiness.band === 'amber') {
    band = 'amber';
    headline = readiness.headline;
    sub = readiness.action;
  } else if (work.band === 'red') {
    band = 'amber';   // work never gets to be the day's red — it is not the knee
    headline = 'Training is fine. Work is not.';
    sub = work.detail;
  } else {
    band = 'green';
    headline = ctx.raceWeek ? `Race week — ${ctx.raceWeek.name}` : readiness.headline;
    sub = ctx.raceWeek
      ? 'Sharpening, not building. Keep every movement, lose the fatigue, and drop Day 5.'
      : readiness.action;
  }

  return { ctx, readiness, knee, rung, session, q, work, next, headline, sub, band };
}

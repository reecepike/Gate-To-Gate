/**
 * One day, assembled.
 *
 * Every screen in this app is a view onto the same question — what should I be
 * doing right now, and why — so the assembly happens once, here, rather than
 * each page loading its own eight tables and reaching its own slightly
 * different conclusion.
 *
 * The order matters. Readiness comes first because it can cancel the training.
 * The planner comes next because everything downstream reads the timetable it
 * produces. The score comes last because it is a judgement on the other two and
 * has nothing to say until they exist.
 */

import 'server-only';
import {
  getSettings, getReadiness, recentReadiness, recentKnee, getKnee,
  allJobs, eventsOn, getCommitments, blocksOn, saveDay, allGoals, allMilestones,
  balanceSignal, recentScores, saveScore, sessionsBetween, workLogBetween,
  type StoredBlock,
} from './db';
import { toIso, addDays } from './plan';
import { context, type Context } from './coach';
import { assess, sleepHoursFrom, type Verdict } from './readiness';
import { kneeVerdict, rungFor, type KneeVerdict, type RungVerdict } from './knee';
import { prescribe } from './gym';
import { buildDay, nowCard, type DayPlan, type NowCard, type Block } from './planner';
import { scoreDay, trend, type DayScore } from './score';
import { progressOf, goalsTouchedBy, type Goal, type GoalProgress } from './goals';
import { toMin } from './clock';

export type Today = {
  day: string;
  /** Minutes past midnight, on the server. */
  now: number;
  partOfDay: 'morning' | 'afternoon' | 'evening';
  ctx: Context;
  settings: Awaited<ReturnType<typeof getSettings>>;
  readiness: Verdict | null;
  /** True until the morning check-in exists — the gate on the whole app. */
  needsCheckIn: boolean;
  sleepH: number | null;
  knee: KneeVerdict;
  rung: RungVerdict;
  plan: DayPlan;
  blocks: StoredBlock[];
  now_: NowCard | null;
  score: DayScore;
  scoreTrend: ReturnType<typeof trend>;
  goals: GoalProgress[];
  /** The single most important thing today, and why it is that. */
  priority: { title: string; detail: string; kind: string } | null;
};

function partOf(now: number): Today['partOfDay'] {
  if (now < 12 * 60) return 'morning';
  if (now < 17 * 60) return 'afternoon';
  return 'evening';
}

export async function loadToday(dayIso?: string): Promise<Today> {
  const day = dayIso ?? toIso(new Date());
  const isToday = day === toIso(new Date());
  const nowDate = new Date();
  const now = isToday ? nowDate.getHours() * 60 + nowDate.getMinutes() : 12 * 60;

  const [
    settings, readinessRow, history, kneeLogs, kneeToday, jobs,
    events, commitments, existing, goals, milestones, balance, scores,
  ] = await Promise.all([
    getSettings(), getReadiness(day), recentReadiness(day, 30), recentKnee(day, 40),
    getKnee(day), allJobs(), eventsOn(day), getCommitments(), blocksOn(day),
    allGoals(), allMilestones(), balanceSignal(day), recentScores(day, 14),
  ]);

  const ctx = context(day);
  const readiness = readinessRow ? assess(readinessRow, history.filter((r) => r.day !== day)) : null;
  const sleepH = readinessRow ? sleepHoursFrom(readinessRow) : null;
  const knee = kneeVerdict(day, kneeLogs);
  const rung = rungFor(day, kneeLogs);

  // The check-in gates the app once a day and no more. An edit later is fine;
  // being asked again at four o'clock is not.
  const needsCheckIn = isToday && !readinessRow?.checked_in_at;

  const gym = ctx.gym ? prescribe(day, ctx.gym, rung.rung, rung.suspended) : null;
  const training = gym
    ? {
      title: gym.replaces ? gym.replaces.title : `${gym.day.title}`,
      minutes: gym.replaces ? 25 : gym.day.minutes,
      detail: gym.replaces ? gym.replaces.title : gym.day.subtitle,
    }
    : null;

  /* --------------------------------------------------------- the plan */

  // Anything locked, done or hand-made survives replanning untouched.
  const keep: Block[] = existing.filter((b) => b.locked || b.status !== 'planned' || !b.generated);

  const plan = buildDay({
    day,
    now: isToday ? now : null,
    settings: {
      wake: settings.wake_time,
      bed: settings.bed_time,
      rpmDailyH: settings.rpm_daily_h,
      workCapH: settings.work_cap_h,
      freeFloorMin: settings.free_floor_min,
    },
    wakeActual: readinessRow?.up_at ?? readinessRow?.woke_at ?? null,
    readiness,
    events,
    commitments,
    keep,
    jobs,
    training,
    kneeDone: kneeToday?.knee10 ?? false,
    balance,
    goals: goals.map((g) => ({ id: g.id, title: g.title, area: g.area, status: g.status })),
  });

  // Persist so the calendar, the score and tomorrow's balance signal all read
  // the same day. Cheap, and it makes the plan a record rather than a guess
  // that is regenerated slightly differently on every refresh.
  await saveDay(day, plan.blocks);
  const blocks = await blocksOn(day);

  /* -------------------------------------------------------- the score */

  const [sessions, workLog] = await Promise.all([
    sessionsBetween(day, day),
    workLogBetween(day, day),
  ]);
  const trainedMin = sessions.filter((s) => s.completed).reduce((a, s) => a + (s.duration_min ?? 0), 0);
  const workedMin = workLog.reduce((a, w) => a + w.minutes, 0);
  const touched = goalsTouchedBy(
    blocks.map((b) => ({ kind: b.kind, goalId: b.goalId, status: b.status })),
    goals,
  );

  const score = scoreDay({
    day,
    readiness,
    plan,
    blocks,
    trainedMin,
    workedMin,
    kneeDone: kneeToday?.knee10 ?? false,
    workCapH: settings.work_cap_h,
    freeFloorMin: settings.free_floor_min,
    sleepH,
    sleepTargetH: settings.sleep_target_h,
    goalsTouched: touched.length,
    dayOver: !isToday || now >= toMin(settings.bed_time),
  });

  if (score.score !== null) {
    await saveScore(day, score.score, score.band, { parts: score.parts }, score.confidence, score.headline);
  }

  /* -------------------------------------------------------- the goals */

  const goalViews = goals
    .filter((g) => g.status === 'active')
    .map((g) => progressOf(g as Goal, milestones));

  /* ----------------------------------------------- the single priority */

  const priority = pickPriority(plan, readiness, knee);

  return {
    day,
    now,
    partOfDay: partOf(now),
    ctx,
    settings,
    readiness,
    needsCheckIn,
    sleepH,
    knee,
    rung,
    plan,
    blocks,
    now_: isToday ? nowCard(plan, now) : null,
    score,
    scoreTrend: trend(scores.map((s) => ({ day: s.day, score: s.score }))),
    goals: goalViews,
    priority,
  };
}

/**
 * The one thing that matters today.
 *
 * Not the first thing on the timetable — the thing that would make today a
 * failure if it did not happen. A red knee outranks everything. A race outranks
 * work. After that it is the first real commitment of the day, which is usually
 * the answer anyway.
 */
function pickPriority(
  plan: DayPlan,
  readiness: Verdict | null,
  knee: KneeVerdict,
): Today['priority'] {
  if (knee.band === 'red') {
    return { title: 'The left leg', detail: knee.line, kind: 'knee' };
  }
  const race = plan.blocks.find((b) => b.kind === 'ski');
  if (race) return { title: race.title, detail: race.why ?? 'Everything else today arranges itself around this.', kind: 'ski' };

  const firstWork = plan.blocks.filter((b) => b.kind === 'work' || b.kind === 'own').sort((a, b) => a.start - b.start)[0];
  if (firstWork) return { title: firstWork.title, detail: firstWork.why ?? '', kind: firstWork.kind };

  const train = plan.blocks.find((b) => b.kind === 'train');
  if (train) return { title: train.title, detail: train.why ?? '', kind: 'train' };

  if (readiness?.band === 'red') {
    return { title: 'Recovery', detail: readiness.action, kind: 'recovery' };
  }
  return null;
}

export { addDays };

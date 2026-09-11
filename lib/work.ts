/**
 * The boss.
 *
 * The training plan works because 45 weeks of sessions are known in advance and
 * the engine only adjusts them. Work is not like that — things arrive
 * unannounced. So this is not a calendar. It is a prioritiser that knows
 * exactly how little time you actually have, and says so.
 *
 * Two decisions shape everything below:
 *
 *   1. Capacity comes from the week timetable, not from optimism. Your own
 *      businesses get one ring-fenced slot (Sunday 18:30, 90 min) and four
 *      evenings that exist but are not free in the sense that spending all of
 *      them is free. Wednesday has nothing. That is the budget.
 *
 *   2. A job you are waiting on someone else for is not work. It goes on a
 *      separate chase list, because a two-minute email that unblocks a fortnight
 *      is the highest-leverage thing on the page — and because leaving it in the
 *      do-list makes you feel busy while nothing moves.
 */

import { addDays, daysBetween, dow, fmt, fromIso, RACES } from './plan';
import { DEFAULT_SLOTS, WorkSlot } from './week';

export type JobKind = 'build' | 'fix' | 'content' | 'seo' | 'admin' | 'pitch' | 'mtb' | 'personal';

export const KINDS: { key: JobKind; label: string }[] = [
  { key: 'build', label: 'Build' },
  { key: 'fix', label: 'Fix / support' },
  { key: 'content', label: 'Content' },
  { key: 'seo', label: 'SEO' },
  { key: 'pitch', label: 'Pitch / quote' },
  { key: 'admin', label: 'Admin / invoicing' },
  { key: 'mtb', label: 'Lyne MTB' },
  { key: 'personal', label: 'Personal' },
];

export type Job = {
  id: number;
  client: string | null;
  title: string;
  kind: JobKind;
  due: string | null;
  est_min: number;
  logged_min: number;
  value_gbp: number | null;
  /** Who you are blocked on. Non-null means chase, not do. */
  waiting_on: string | null;
  /** What finishing this frees up. */
  unblocks: string | null;
  /** The one you keep sliding down the list. */
  dread: boolean;
  status: 'todo' | 'doing' | 'parked' | 'done';
  last_touched: string | null;
  created_at: string;
  notes: string | null;
};

/* ------------------------------------------------------------ capacity */

export type SlotInstance = { day: string; slot: WorkSlot };

/**
 * A race day is not a work evening, and neither is the night before one. This
 * is the whole point of the two halves living in one app: the work prioritiser
 * knows you are in Llandudno on the 20th, so it stops pretending you have
 * ninety minutes that evening and tells you now rather than on the day.
 */
export function isRaceDay(day: string): boolean {
  return RACES.some((r) => !r.test && day >= addDays(r.day, -1) && day <= r.end);
}

/** Every work slot from `from` to `to` inclusive, race weekends excluded. */
export function slotsBetween(from: string, to: string, slots: WorkSlot[] = DEFAULT_SLOTS): SlotInstance[] {
  if (to < from) return [];
  const out: SlotInstance[] = [];
  const span = Math.min(daysBetween(from, to), 400);
  for (let i = 0; i <= span; i++) {
    const day = addDays(from, i);
    if (isRaceDay(day)) continue;
    const wd = dow(day);
    for (const s of slots) if (s.weekday === wd) out.push({ day, slot: s });
  }
  return out.sort((a, b) => (a.day === b.day ? a.slot.time.localeCompare(b.slot.time) : a.day.localeCompare(b.day)));
}

/** Minutes of slot lost to race weekends between two dates. */
export function lostToRaces(from: string, to: string, slots: WorkSlot[] = DEFAULT_SLOTS): number {
  if (to < from) return 0;
  let lost = 0;
  const span = Math.min(daysBetween(from, to), 400);
  for (let i = 0; i <= span; i++) {
    const day = addDays(from, i);
    if (!isRaceDay(day)) continue;
    for (const s of slots) if (s.weekday === dow(day)) lost += s.minutes;
  }
  return lost;
}

export function capacityMinutes(from: string, to: string, slots: WorkSlot[] = DEFAULT_SLOTS): number {
  return slotsBetween(from, to, slots).reduce((a, s) => a + s.slot.minutes, 0);
}

export function nextSlot(from: string, slots: WorkSlot[] = DEFAULT_SLOTS): SlotInstance | null {
  return slotsBetween(from, addDays(from, 8), slots)[0] ?? null;
}

/** Minutes of work slot on a specific day. */
export function slotsOn(day: string, slots: WorkSlot[] = DEFAULT_SLOTS): WorkSlot[] {
  return slots.filter((s) => s.weekday === dow(day)).sort((a, b) => a.time.localeCompare(b.time));
}

/* ------------------------------------------------------------- scoring */

export type Factor = { label: string; weight: number; value: number };

export type Scored = {
  job: Job;
  score: number;
  remaining: number;
  daysLeft: number | null;
  /** Work-slot minutes available between now and the deadline. */
  capacityToDue: number | null;
  atRisk: boolean;
  fitsNextSlot: boolean;
  factors: Factor[];
  reason: string;
};

const W = { urgency: 40, leverage: 18, money: 18, rot: 16, fit: 8 };

function clamp(x: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Value per remaining hour. Used relatively, never absolutely — see `score`. */
function ratePerHour(job: Job): number {
  if (!job.value_gbp) return 0;
  const remaining = Math.max(job.est_min - job.logged_min, 15);
  return job.value_gbp / (remaining / 60);
}

export function score(
  job: Job,
  today: string,
  slots: WorkSlot[] = DEFAULT_SLOTS,
  maxRate = 0,
): Scored {
  const remaining = Math.max(job.est_min - job.logged_min, 0);
  const daysLeft = job.due ? daysBetween(today, job.due) : null;
  const capacityToDue = job.due ? capacityMinutes(today, job.due, slots) : null;
  const next = nextSlot(today, slots);

  /* urgency — is there still room to finish it before it is due? */
  let urgency: number;
  if (daysLeft === null) urgency = 0.2;
  else if (daysLeft < 0) urgency = 1;
  else {
    const cap = Math.max(capacityToDue ?? 0, 30);
    urgency = clamp((remaining / cap) * 0.85);
    // Proximity floors. Something due tomorrow does not sit below something due
    // in six days, however profitable the six-day job is.
    if (daysLeft <= 1) urgency = Math.max(urgency, 0.9);
    else if (daysLeft <= 3) urgency = Math.max(urgency, 0.75);
    else if (daysLeft <= 7) urgency = Math.max(urgency, 0.45);
  }

  /* leverage — does finishing this free something or someone else? */
  const leverage = job.unblocks ? 0.85 : 0;

  /* money — value per remaining hour, relative to the best rate on the board.
     An absolute reference (£60/h, say) flattens everything above it, which is
     exactly where the interesting differences are: a fifteen-minute invoice for
     £1,200 and a four-hour build for £850 are not the same decision. */
  const vph = ratePerHour(job);
  const money = maxRate > 0 ? Math.sqrt(clamp(vph / maxRate)) : 0;

  /* rot — how long since you touched it. Doubles as the avoidance detector. */
  const since = daysBetween(job.last_touched ?? job.created_at, today);
  let rot = clamp(since / 21);
  if (job.dread) rot = clamp(rot * 1.4 + 0.15);

  /* fit — does it actually go in the next slot you have? */
  const fit = !next ? 0 : remaining <= next.slot.minutes ? 1 : remaining <= next.slot.minutes * 2 ? 0.45 : 0.1;

  const factors: Factor[] = [
    { label: 'Deadline', weight: W.urgency, value: urgency },
    { label: 'Unblocks', weight: W.leverage, value: leverage },
    { label: 'Money', weight: W.money, value: money },
    { label: 'Been sitting', weight: W.rot, value: rot },
    { label: 'Fits the slot', weight: W.fit, value: fit },
  ];

  let total = factors.reduce((a, f) => a + f.value * f.weight, 0);
  if (job.status === 'doing') total += 6;   // finish what is already open

  const atRisk = capacityToDue !== null && remaining > capacityToDue;

  return {
    job, score: Math.round(total), remaining, daysLeft, capacityToDue, atRisk,
    fitsNextSlot: !!next && remaining <= next.slot.minutes,
    factors,
    reason: reasonFor(job, { urgency, leverage, money, rot, fit }, daysLeft, remaining, capacityToDue, atRisk, today),
  };
}

function hm(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? (m ? `${h} h ${m} m` : `${h} h`) : `${m} m`;
}

function reasonFor(
  job: Job,
  f: { urgency: number; leverage: number; money: number; rot: number; fit: number },
  daysLeft: number | null,
  remaining: number,
  capacityToDue: number | null,
  atRisk: boolean,
  today: string,
): string {
  if (remaining === 0) {
    return 'You have logged the whole estimate. Either it is finished — close it — or the estimate was wrong, in which case fix it now while you still remember why.';
  }
  if (atRisk && daysLeft !== null) {
    return daysLeft < 0
      ? `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'}, with ${hm(remaining)} still on it.`
      : `${hm(remaining)} left and only ${hm(capacityToDue ?? 0)} of slot before it is due. It does not fit — move the date or cut the scope.`;
  }
  if (daysLeft !== null && daysLeft <= 3) {
    return daysLeft === 0 ? 'Due today.' : `Due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}, ${hm(remaining)} left.`;
  }
  const top = Math.max(f.urgency * W.urgency, f.leverage * W.leverage, f.money * W.money, f.rot * W.rot);
  if (top === f.leverage * W.leverage && job.unblocks) return `Finishing it unblocks ${job.unblocks}.`;
  if (top === f.rot * W.rot) {
    return job.dread
      ? 'This is the one you keep sliding down the list. That is exactly why it is here.'
      : `Untouched for ${daysBetween(job.last_touched ?? job.created_at, today)} days.`;
  }
  if (top === f.money * W.money && job.value_gbp) {
    const rate = Math.round(ratePerHour(job));
    return `£${job.value_gbp} for ${hm(remaining)} — about £${rate} an hour, the best rate open to you.`;
  }
  if (daysLeft !== null && job.due) return `Due ${fmt(job.due)}, ${hm(remaining)} left.`;
  return `${hm(remaining)} of work, no deadline on it.`;
}

/* ------------------------------------------------------------- queues */

export type Queues = {
  /** What to actually do, best first. */
  doNow: Scored[];
  /** Blocked on someone else — chase, do not do. */
  chase: { job: Job; waitingDays: number }[];
  parked: Job[];
};

export function queues(jobs: Job[], today: string, slots: WorkSlot[] = DEFAULT_SLOTS): Queues {
  const live = jobs.filter((j) => j.status === 'todo' || j.status === 'doing');
  const actionable = live.filter((j) => !j.waiting_on);
  const maxRate = Math.max(0, ...actionable.map(ratePerHour));
  const doNow = actionable
    .map((j) => score(j, today, slots, maxRate))
    .sort((a, b) => b.score - a.score);
  const chase = live
    .filter((j) => j.waiting_on)
    .map((j) => ({ job: j, waitingDays: daysBetween(j.last_touched ?? j.created_at, today) }))
    .sort((a, b) => b.waitingDays - a.waitingDays);
  return { doNow, chase, parked: jobs.filter((j) => j.status === 'parked') };
}

/* ------------------------------------------------------------ verdict */

export type WorkVerdict = {
  band: 'green' | 'amber' | 'red';
  headline: string;
  detail: string;
  openMinutes: number;
  capacity14: number;
  overBy: number;
  atRisk: Scored[];
};

export function workVerdict(q: Queues, today: string, slots: WorkSlot[] = DEFAULT_SLOTS): WorkVerdict {
  const openMinutes = q.doNow.reduce((a, s) => a + s.remaining, 0);
  const capacity14 = capacityMinutes(today, addDays(today, 13), slots);
  const overBy = openMinutes - capacity14;
  const atRisk = q.doNow.filter((s) => s.atRisk);

  if (!q.doNow.length) {
    return {
      band: 'green', headline: 'Nothing open', openMinutes, capacity14, overBy, atRisk,
      detail: q.chase.length
        ? `Nothing to do — but ${q.chase.length} job${q.chase.length === 1 ? ' is' : 's are'} waiting on someone else. Chase, then enjoy the evening.`
        : 'Genuinely clear. Take the evening back.',
    };
  }

  if (atRisk.length) {
    return {
      band: 'red',
      headline: `${atRisk.length} job${atRisk.length === 1 ? '' : 's'} cannot fit before ${atRisk.length === 1 ? 'its' : 'their'} deadline`,
      openMinutes, capacity14, overBy, atRisk,
      detail:
        `You have ${hm(openMinutes)} open and ${hm(capacity14)} of slot in the next fortnight. ` +
        `The arithmetic has already decided — move a date, cut the scope, or park something. ` +
        `Doing nothing means it gets decided for you, late, by whoever shouts.`,
    };
  }

  if (overBy > 0) {
    return {
      band: 'amber',
      headline: `Over capacity by ${hm(overBy)}`,
      openMinutes, capacity14, overBy, atRisk,
      detail:
        `${hm(openMinutes)} of open work against ${hm(capacity14)} of slot before ${fmt(addDays(today, 13))}. ` +
        `Nothing is late yet, so this is a choice you still get to make: park the bottom of the list now, ` +
        `or borrow evenings you were going to need for something else.`,
    };
  }

  return {
    band: 'green',
    headline: 'Inside capacity',
    openMinutes, capacity14, overBy, atRisk,
    detail: `${hm(openMinutes)} of open work against ${hm(capacity14)} of slot in the next fortnight. It fits. Work the list in order and do not add to it without taking something off.`,
  };
}

/* ---------------------------------------------------- what to do next */

export type NextUp = {
  slot: SlotInstance | null;
  pick: Scored | null;
  /** What actually goes in the slot, in order, until it is full. */
  fill: Scored[];
  line: string;
  alsoChase: { job: Job; waitingDays: number } | null;
};

function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function label(j: Job): string {
  return j.client ? `${j.title} (${j.client})` : j.title;
}

/**
 * The single instruction — and it fills the whole slot, not just the top row.
 * "Do the highest-priority thing" is useless advice when the highest-priority
 * thing is a fifteen-minute invoice and you have two hours.
 */
export function nextUp(q: Queues, today: string, slots: WorkSlot[] = DEFAULT_SLOTS): NextUp {
  const slot = nextSlot(today, slots);
  const chase = q.chase[0] ?? null;

  if (!q.doNow.length) {
    return { slot, pick: null, fill: [], line: 'Nothing on the do-list. Do not go looking for work at 21:00.', alsoChase: chase };
  }

  const top = q.doNow[0];
  const mins = slot?.slot.minutes ?? 90;
  const when = slot
    ? slot.day === today
      ? `Tonight at ${slot.slot.time}`
      : `${fromIso(slot.day).toLocaleDateString('en-GB', { weekday: 'long' })} at ${slot.slot.time}`
    : 'Your next free block';

  /* Pack the slot, best first, skipping anything that will not fit in what is left. */
  const fill: Scored[] = [];
  let left = mins;
  for (const s of q.doNow) {
    if (s.remaining <= left) { fill.push(s); left -= s.remaining; }
    if (left < 15) break;
  }

  let line: string;
  if (top.remaining > mins) {
    const chunks = Math.ceil(top.remaining / mins);
    line =
      `${when} you have ${hm(mins)}. ${label(top.job)} is ${hm(top.remaining)}, so that is ${chunks} sittings — ` +
      `decide now which part you are doing tonight, or you will spend the slot re-reading the brief. ${top.reason}`;
  } else if (fill.length === 1) {
    line = `${when}, ${hm(mins)}: ${label(top.job)} — ${hm(top.remaining)}. ${top.reason}` +
      (left >= 30 ? ` That leaves ${hm(left)}; nothing else on the list fits it, so stop there.` : '');
  } else {
    const names = fill.map((s) => `${label(s.job)} (${hm(s.remaining)})`);
    line =
      `${when} you have ${hm(mins)}. Start with ${names[0]} — ${lower(top.reason)} ` +
      `Then ${names.slice(1).join(', then ')}. ` +
      (left >= 15 ? `${hm(left)} spare, and leaving it spare is the right call.` : 'That fills it exactly.');
  }

  return { slot, pick: top, fill, line, alsoChase: chase };
}

export { hm as fmtMinutes };

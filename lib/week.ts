/**
 * The default week. Two fixed points: nothing starts before 07:30, and
 * Wednesday belongs to Aldershot. Everything else is arranged around those.
 *
 * This file is the single source of truth for where your time actually goes —
 * the work prioritiser reads its capacity from it, which is why it refuses to
 * pretend you have more evenings than you do.
 */

import { dow, isRaceWeek, raceThisWeek, Race } from './plan';

export type Kind = 'sleep' | 'gym' | 'work' | 'ski' | 'knee' | 'fuel' | 'recovery' | 'golf' | 'own' | 'free' | 'admin';

export type Slot = {
  time: string;
  label: string;
  detail: string;
  kind: Kind;
  /** Minutes, where the block has a defined length. */
  minutes?: number;
};

export type DayPlan = {
  weekday: number;           // 1 = Mon
  name: string;
  headline: string;
  slots: Slot[];
};

export const WEEK: DayPlan[] = [
  {
    weekday: 1, name: 'Monday', headline: 'Lower A — strength',
    slots: [
      { time: '07:30', label: 'Up', detail: 'Banana and 300 ml milk, 400 ml water. Light — the real breakfast comes after.', kind: 'fuel' },
      { time: '08:15', label: 'Gym — Day 1: Lower A', detail: 'Strength and rehab. The heaviest session of the week. Warm up longer than feels necessary.', kind: 'gym', minutes: 80 },
      { time: '09:45', label: 'Breakfast proper', detail: 'Eat inside 45 min of racking the bar.', kind: 'fuel' },
      { time: '10:15', label: 'RPM — deep work', detail: 'Post-training focus window. No meetings before 13:00.', kind: 'work' },
      { time: '14:00', label: 'RPM — calls & delivery, to 18:45', detail: '', kind: 'work' },
      { time: '20:30', label: 'Knee 10', detail: 'Daily prehab block. Non-negotiable.', kind: 'knee', minutes: 10 },
      { time: '21:00', label: 'Spare evening', detail: 'Genuinely free. The first place work goes when Sunday is not enough.', kind: 'free', minutes: 90 },
      { time: '23:15', label: 'Lights out', detail: '8 h 15 to a 07:30 alarm.', kind: 'sleep' },
    ],
  },
  {
    weekday: 2, name: 'Tuesday', headline: 'Push + aerobic',
    slots: [
      { time: '07:30', label: 'Up', detail: 'Same light pre-feed as Monday.', kind: 'fuel' },
      { time: '08:15', label: 'Gym — Day 2: Push', detail: 'Chest, front and side delts, triceps, core. Zero leg load the day before gates — that is deliberate.', kind: 'gym', minutes: 60 },
      { time: '09:25', label: 'Z2 — 25–30 min', detail: 'Run, bike or swim, your pick. Easy aerobic after upper lifting barely interferes; after leg day it eats the session.', kind: 'gym', minutes: 30 },
      { time: '10:15', label: 'RPM — through to 18:45', detail: 'Clear Wednesday’s decks today. Tomorrow is 5¾ hours.', kind: 'work' },
      { time: '20:00', label: 'Knee 10 · Wednesday prep', detail: 'Pack kit and Wednesday’s food tonight, not tomorrow morning.', kind: 'knee', minutes: 30 },
      { time: '21:00', label: 'Spare evening', detail: 'Free, but Wednesday is long — do not spend it all.', kind: 'free', minutes: 60 },
      { time: '23:15', label: 'Lights out', detail: '', kind: 'sleep' },
    ],
  },
  {
    weekday: 3, name: 'Wednesday', headline: 'Gates — Aldershot',
    slots: [
      { time: '08:15', label: 'RPM — compressed day', detail: '5¾ hours, hard stop 14:00. Nothing scheduled after 13:00. Go in with a written list, not a vague plan.', kind: 'work' },
      { time: '12:30', label: 'Main fuel of the day', detail: '~800 kcal, 50 g protein, real carbs. This is the meal that fuels the session — do not skip it because you are rushing to finish work.', kind: 'fuel' },
      { time: '14:15', label: 'Drive south', detail: '~2 h 30 to Aldershot. Food and water in the car, packed last night. Flapjack or bananas in the door pocket.', kind: 'ski' },
      { time: '18:00', label: '90 min gates', detail: 'The session everything else exists to support. Arrive fed, warm and not sore.', kind: 'ski', minutes: 90 },
      { time: '20:30', label: 'Eat before you drive', detail: 'Prepped meal in the boot. Do not get home at midnight having eaten a garage sandwich.', kind: 'fuel' },
      { time: '23:45', label: 'Home → shower → bed', detail: 'Shower, cool dark room, no screens. Asleep by 00:30. Phone on charge downstairs.', kind: 'sleep' },
    ],
  },
  {
    weekday: 4, name: 'Thursday', headline: 'Shoulders, arms, swim',
    slots: [
      { time: '09:00', label: 'Protected lie-in', detail: '8 h 30 from 00:30. Planned, not slacking — the only day that starts later than 07:30, and it is earned.', kind: 'sleep' },
      { time: '10:00', label: 'RPM — through to 18:45', detail: '', kind: 'work' },
      { time: '19:15', label: 'Gym — Day 3: Conditioning & Shoulders', detail: 'Row intervals, delts, arms, mobility. No leg loading at all — the day after Aldershot the leg gets a pass.', kind: 'gym', minutes: 55 },
      { time: '20:20', label: 'Swim 1 km + contrast spa', detail: 'Easy mixed strokes, then sauna 12 min → plunge 90 s, ×3. Best cold day of the week.', kind: 'recovery', minutes: 60 },
      { time: '21:45', label: 'Knee 10 · swelling check', detail: 'Deep-flexion ROM, then the stroke test. Log it.', kind: 'knee', minutes: 15 },
      { time: '23:00', label: 'Lights out', detail: '', kind: 'sleep' },
    ],
  },
  {
    weekday: 5, name: 'Friday', headline: 'Lower B — power',
    slots: [
      { time: '07:30', label: 'Up', detail: 'Eat properly before this one. Plyometrics on an empty stomach is a poor trade.', kind: 'fuel' },
      { time: '08:15', label: 'Gym — Day 4: Lower B', detail: 'Power, plyometrics and stability. Longest warm-up of the week. Stop the plyo block the moment jump height drops.', kind: 'gym', minutes: 75 },
      { time: '10:15', label: 'RPM — finish 18:00', detail: 'Wrap the week early. You earned it Monday to Wednesday.', kind: 'work' },
      { time: '19:30', label: 'Knee 10', detail: '', kind: 'knee', minutes: 10 },
      { time: '20:00', label: 'Free evening', detail: 'If racing Saturday: kit check, early night, no golf today.', kind: 'free', minutes: 120 },
      { time: '23:30', label: 'Lights out', detail: '', kind: 'sleep' },
    ],
  },
  {
    weekday: 6, name: 'Saturday', headline: 'Pull + golf, or race',
    slots: [
      { time: '08:00', label: 'Weigh-in', detail: 'Fasted, post-toilet, same scales. One number a week. Ninety seconds, then go back to bed if you want.', kind: 'admin', minutes: 5 },
      { time: '09:30', label: 'Golf — walking 18', detail: '~12 k steps. This is your aerobic base, not a rest day. Count it.', kind: 'golf', minutes: 240 },
      { time: '16:00', label: 'Gym — Day 5: Pull', detail: 'Back, rear delts, biceps, grip. Pairs perfectly with a morning round. Skip if racing Sunday.', kind: 'gym', minutes: 65 },
      { time: '19:00', label: 'Sauna', detail: '15–20 min. No plunge within 6 h of Day 5.', kind: 'recovery', minutes: 20 },
      { time: '20:00', label: 'Knee 10 · free evening', detail: '', kind: 'free', minutes: 90 },
      { time: '23:30', label: 'Lights out', detail: '', kind: 'sleep' },
    ],
  },
  {
    weekday: 7, name: 'Sunday', headline: 'Golf, bike or race',
    slots: [
      { time: '09:30', label: 'Golf 18, or MTB', detail: 'MTB once a month — never the week before a race. It is the only real crash risk in this plan.', kind: 'golf', minutes: 240 },
      { time: '15:00', label: 'Swim — easy 1000 m', detail: 'Only if you did not play golf. Otherwise rest.', kind: 'recovery', minutes: 45 },
      { time: '18:30', label: '90 min — own businesses', detail: 'Ring-fenced for RP Web Studio and Lyne MTB. The only slot they are guaranteed, so protect it.', kind: 'own', minutes: 90 },
      { time: '20:00', label: 'Week plan · food shop', detail: 'Ten minutes here saves the whole week.', kind: 'admin', minutes: 20 },
      { time: '20:30', label: 'Knee 10', detail: '', kind: 'knee', minutes: 10 },
      { time: '23:15', label: 'Lights out', detail: '', kind: 'sleep' },
    ],
  },
];

export function dayPlan(iso: string): DayPlan {
  return WEEK[dow(iso) - 1];
}

/* ------------------------------------------------- race week override */

export const RACE_OVERRIDE: { day: string; change: string; why: string }[] = [
  { day: 'Mon', change: 'Day 1 as normal', why: 'Furthest point from the race. Load it here or nowhere.' },
  { day: 'Tue', change: 'Day 2, cut top sets by one', why: 'Keep the movement, lose the fatigue.' },
  { day: 'Wed', change: 'Gates as normal, but ski to feel', why: 'Sharpening, not building. Do not chase a breakthrough three days out.' },
  { day: 'Thu', change: 'Day 3 as normal, sauna only — no plunge', why: 'Keep the spa hot and short; long cold pre-race leaves you flat.' },
  { day: 'Fri', change: 'Day 4 becomes a 25 min priming session', why: '3×3 trap bar jumps @ 30%, 3×3 split jumps, 2×20 m sled. No golf, no MTB.' },
  { day: 'Sat/Sun', change: 'Race. Day 5 is dropped', why: 'Pull is the session that gives way in a race week.' },
  { day: 'Mon after', change: 'Day 1 becomes pool + spa', why: 'Full contrast, plunge encouraged. Lift Tuesday instead and shift the week back a day.' },
];

export function weekOverride(iso: string): Race | null {
  return isRaceWeek(iso) ? raceThisWeek(iso) : null;
}

/* -------------------------------------------------------- week ticks */

/** The sixteen things that make a week a good week. */
export const WEEK_TASKS: string[] = [
  'Mon — Day 1: Lower A, strength',
  'Tue — Day 2: Push',
  'Tue — Z2 run 30–40 min',
  'Tue — pack Wednesday’s food & kit',
  'Wed — Aldershot gates',
  'Thu — swelling test + log it',
  'Thu — Day 3: conditioning, shoulders & arms',
  'Thu — 1 km swim + contrast spa',
  'Fri — Day 4: Lower B, power & plyo',
  'Sat — weigh-in (fasted)',
  'Sat — Day 5: Pull, or race',
  'Golf round 1',
  'Golf round 2',
  'Knee 10 — done all seven days',
  'Sun — 90 min own businesses',
  'Sun — plan the week ahead',
];

/* ---------------------------------------------------- work capacity */

/**
 * Honest capacity for RP Web Studio and Lyne MTB. RPM hours are not in here —
 * they are someone else's and they are already spoken for.
 *
 * Sunday's 90 minutes is the only slot that is actually ring-fenced. The rest
 * is evenings that exist but are not free in the sense that spending all of
 * them is free: Wednesday has none, and Tuesday's is borrowed against a day
 * that ends at 00:30.
 */
export type WorkSlot = {
  weekday: number;
  time: string;
  minutes: number;
  label: string;
  protected: boolean;
};

export const DEFAULT_SLOTS: WorkSlot[] = [
  { weekday: 7, time: '18:30', minutes: 90, label: 'Sunday — ring-fenced', protected: true },
  { weekday: 1, time: '21:00', minutes: 90, label: 'Monday evening', protected: false },
  { weekday: 5, time: '20:00', minutes: 120, label: 'Friday evening', protected: false },
  { weekday: 6, time: '20:00', minutes: 90, label: 'Saturday evening', protected: false },
  { weekday: 2, time: '21:00', minutes: 60, label: 'Tuesday evening (borrowed against Wednesday)', protected: false },
];

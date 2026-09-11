/**
 * The five-day split, with the block doing the scaling.
 *
 * The one rule that outranks everything else here: every single-leg exercise
 * starts with the LEFT leg, and the right never gets more reps than the left
 * managed. It closes the asymmetry faster than any exercise selection, and it
 * stops you quietly training the gap wider for eleven months.
 */

import { Block, blockFor, isRaceWeek, dow } from './plan';
import { LADDER, Rung } from './knee';

export const LEFT_FIRST_RULE =
  'Every single-leg exercise starts with the left leg. The right never gets more reps than the left managed. Load only rises when both sides clear the target.';

export type Exercise = {
  name: string;
  sets: string;
  note: string;
  /** Left leg leads. */
  left?: boolean;
  /** A compound whose prescription comes from the block. */
  compound?: boolean;
  /** Physique / isolation work — this is what the later blocks trim. */
  iso?: boolean;
  /** The plyometric block, filled from the current rung. */
  plyo?: boolean;
};

export type GymDay = {
  n: 1 | 2 | 3 | 4 | 5;
  key: 'lowerA' | 'push' | 'cond' | 'lowerB' | 'pull';
  /** 1 = Mon … 7 = Sun */
  weekday: number;
  time: string;
  title: string;
  subtitle: string;
  minutes: number;
  warmup: string | null;
  exercises: Exercise[];
  tail: string | null;
};

export const DAYS: GymDay[] = [
  {
    n: 1, key: 'lowerA', weekday: 1, time: '08:15', title: 'Lower A', subtitle: 'Strength & rehab', minutes: 80,
    warmup: 'Bike 5 min, ankle dorsiflexion, 90/90 hip rotations, glute bridge ×15, then Spanish squat 2×30 s. Low shear, high quad activation — exactly what wakes a reconstructed knee before you load it.',
    exercises: [
      { name: 'Trap bar deadlift', sets: '4×6', compound: true, note: 'The biggest single mass driver available to you. Loads the whole posterior chain and the traps at once — a lot of your ten kilos comes from this lift.' },
      { name: 'Single-leg press', sets: '4×8 / leg', left: true, compound: true, note: 'Your primary quad builder and your primary asymmetry closer, doing two jobs at once.' },
      { name: 'Bulgarian split squat', sets: '3×8 / leg', left: true, note: 'Match the right to what the left managed. Load only rises when both sides clear the target.' },
      { name: 'Nordic hamstring curl', sets: '3×5', note: 'Band-assisted to start. Hamstring eccentric strength is the direct defence against the force that took your ACL. Earn this one slowly.' },
      { name: 'Seated calf raise', sets: '4×12', iso: true, note: 'Seated deliberately — targets soleus, which resists the anterior shear the graft takes.' },
      { name: 'Copenhagen adductor', sets: '3×8 / side', note: 'Short-lever to start. Adductor strength protects the meniscus repair under lateral load, and slalom is nothing but lateral load.' },
      { name: 'Tibialis raise', sets: '2×15', iso: true, note: 'Shin strength for boot pressure. Nearly free.' },
      { name: 'Deadbug', sets: '3×10', note: 'Slow, ribs down.' },
    ],
    tail: 'The heaviest session of the week — you are furthest from Wednesday and freshest from the weekend. Warm up longer than feels necessary. Eat inside 45 minutes of racking the bar.',
  },
  {
    n: 2, key: 'push', weekday: 2, time: '08:15', title: 'Push', subtitle: 'Chest, delts, triceps', minutes: 60,
    warmup: null,
    exercises: [
      { name: 'Incline DB press', sets: '4×8', compound: true, note: 'Upper chest fills out the top of a t-shirt, and it is shoulder-friendly.' },
      { name: 'Flat barbell or machine press', sets: '3×8', compound: true, note: 'Eights, not sixes — you want tissue, not a strength PB.' },
      { name: 'Cable fly', sets: '3×12', iso: true, note: 'Controlled, full stretch at the bottom. The stretched position is where most of the growth stimulus lives.' },
      { name: 'Lateral raise', sets: '4×15', iso: true, note: 'Highest visual return of anything in this session. Light, strict, no swinging — momentum means you are training your traps instead.' },
      { name: 'Cable pushdown', sets: '3×12', iso: true, note: 'Twelves. Eight reps on a triceps isolation leaves growth on the table for no strength benefit.' },
      { name: 'Overhead extension', sets: '3×12', iso: true, note: 'Long head — the bit that makes an arm look full from the side.' },
      { name: 'Pallof press', sets: '3×12 / side', note: 'The trunk stiffness that stops your upper body unwinding out of a turn.' },
    ],
    tail: 'Then 25–30 min easy Z2 — run, bike or swim, your pick. Parked here on purpose: easy aerobic after upper-body lifting barely interferes, whereas after a leg day it eats the session you just did. Zero leg load the day before gates is deliberate.',
  },
  {
    n: 3, key: 'cond', weekday: 4, time: '19:15', title: 'Conditioning, Shoulders & Arms', subtitle: 'The day after Aldershot', minutes: 55,
    warmup: null,
    exercises: [
      { name: 'Row intervals', sets: '6×500 m', note: '90 s rest. Hard aerobic work with almost no impact through the knee.' },
      { name: 'Seated shoulder press', sets: '3×10', compound: true, note: 'Front delts and the overhead strength pattern.' },
      { name: 'Lateral raise', sets: '3×15', iso: true, note: 'Second exposure of the week. Delts recover fast and respond to frequency.' },
      { name: 'Rear delt fly', sets: '3×15', iso: true, note: 'Rear delts fill out the back of the shoulder and nobody trains them enough.' },
      { name: 'Face pull', sets: '3×15', iso: true, note: 'Shoulder health insurance. You will take gate contact all winter — this is the cheapest protection available.' },
      { name: 'EZ curl + rope pushdown — superset', sets: '3×12 each', iso: true, note: 'Straight through, minimal rest. Ten minutes, and it takes your arms from once a week to twice.' },
    ],
    tail: 'Mobility block — do not skip. Hip flexor stretch 2–3 min each side, glute activation, knee flexion ROM. Then 1 km swim and the contrast spa: sauna 12 min → plunge 90 s, ×3. Best cold day of the week — twelve hours clear of Friday and light enough that the cold blunts nothing. Finish with the swelling test and log it.',
  },
  {
    n: 4, key: 'lowerB', weekday: 5, time: '08:15', title: 'Lower B', subtitle: 'Power & stability', minutes: 75,
    warmup: 'Longest warm-up of the week, including Spanish squats. Eat properly before this one — plyometrics on an empty stomach is a poor trade.',
    exercises: [
      { name: 'Plyometric block', sets: '4–6 sets', plyo: true, note: 'First, always — before fatigue. If jump height or landing quality drops, the block is over for the day regardless of sets done. Full recovery between sets: this is a nervous-system session, not a conditioning one.' },
      { name: 'Trap bar jump', sets: '5×3', compound: true, note: '30–40% of 1RM, maximum speed. If the bar slows, stop. Speed is the target, not load.' },
      { name: 'Step-up, knee over toe', sets: '3×8 / leg', left: true, note: 'Controlled, knee tracking over the toe.' },
      { name: 'Romanian deadlift', sets: '3×8', compound: true, note: 'Here rather than Monday so the week’s hamstring work is not all stacked on one day.' },
      { name: 'Hamstring curl, slow eccentric', sets: '3×10', note: '3 seconds down. Pairs with Monday’s Nordics rather than duplicating them.' },
      { name: 'Single-leg calf raise', sets: '3×12 / leg', left: true, iso: true, note: 'Standing — gastrocnemius, where Monday’s seated version hits soleus.' },
      { name: 'Banded lateral walk', sets: '3×15', note: 'Glute medius. Slalom lives in the frontal plane.' },
      { name: 'Sled push or lateral sled drag', sets: '3×20 m', note: 'Frontal-plane strength under real load with zero impact — close to a perfect exercise for a slalom skier’s knee.' },
      { name: 'Rotational cable chop', sets: '3×12 / side', note: 'Rotational power through a braced trunk.' },
    ],
    tail: null,
  },
  {
    n: 5, key: 'pull', weekday: 6, time: '16:00', title: 'Pull', subtitle: 'Back, rear delts, biceps, grip', minutes: 65,
    warmup: null,
    exercises: [
      { name: 'Weighted pull-up (or lat pulldown)', sets: '4×8', compound: true, note: 'Pull-ups over pulldowns where you can. Add weight before adding reps — track this number, it tells you whether the ten kilos is useful mass.' },
      { name: 'Chest-supported row', sets: '4×10', compound: true, note: 'Chest-supported so your lower back stays fresh — you deadlifted Monday and RDL’d Friday.' },
      { name: 'Single-arm DB row', sets: '3×10 / side', note: 'Unilateral back work; lets the stronger side pull the weaker one up.' },
      { name: 'Straight-arm pulldown', sets: '3×12', iso: true, note: 'Isolates the lat without the biceps giving out first. A width exercise, and width is most of the taper.' },
      { name: 'Rear delt fly', sets: '3×15', iso: true, note: 'Second exposure of the week.' },
      { name: 'Shrug', sets: '3×12', iso: true, note: 'Traps frame the neck and shoulders and read as built from every angle. Hold the top for a second.' },
      { name: 'Preacher curl', sets: '3×10', iso: true, note: '' },
      { name: 'Hammer curl', sets: '3×10', iso: true, note: 'Brachialis and forearm — thickness rather than peak, and it feeds your grip.' },
      { name: 'Farmer carry', sets: '4×30 m', note: 'Heavy as you can hold. Grip endurance, trunk stiffness and traps at once. Cold hands on plastic in January will thank you.' },
    ],
    tail: 'Pairs well with a morning round — golf costs your legs and your feet, not your lats. Do not do this the day before a race: Day 5 is the session that gives way in a race week.',
  },
];

export const VOLUME: { muscle: string; sets: number; days: number; verdict: string }[] = [
  { muscle: 'Side delts', sets: 7, days: 2, verdict: 'Right at the top of what recovers well. Highest visual payoff in the plan.' },
  { muscle: 'Rear delts + face pulls', sets: 9, days: 2, verdict: 'Generous on purpose — posture, shoulder health, and the fullness most people miss.' },
  { muscle: 'Back (lats, mid, traps)', sets: 17, days: 2, verdict: 'Trap bar Monday plus the whole of Saturday.' },
  { muscle: 'Chest', sets: 10, days: 1, verdict: 'Solid. One day is fine for chest at your training age.' },
  { muscle: 'Biceps', sets: 9, days: 2, verdict: 'Plus everything the rows give you. Twice-weekly beats once.' },
  { muscle: 'Triceps', sets: 9, days: 2, verdict: 'Plus all the pressing. Long-head work included.' },
  { muscle: 'Quads', sets: 10, days: 2, verdict: 'Plus 90 minutes of gates — a huge eccentric quad load in its own right. Deliberately restrained.' },
  { muscle: 'Hamstrings', sets: 9, days: 2, verdict: 'Split across Nordics and RDLs. Graft protection first, size second.' },
  { muscle: 'Calves', sets: 7, days: 2, verdict: 'Seated and standing, so both heads. Serves the look and the boot.' },
];

/* ------------------------------------------------------- block scaling */

/** Which of the five days survive in a given block. */
export function daysInBlock(b: Block): GymDay[] {
  if (b.gymDays >= 5) return DAYS;
  if (b.gymDays === 4) return DAYS.filter((d) => d.key !== 'pull');           // Day 5 drops first
  if (b.gymDays === 3) return DAYS.filter((d) => d.key === 'lowerA' || d.key === 'lowerB' || d.key === 'pull');
  return DAYS.filter((d) => d.key === 'lowerB' || d.key === 'pull');          // 2: one lower, one upper
}

export type Prescribed = {
  day: GymDay;
  compounds: string;
  isolationScale: number;
  plyo: string[];
  raceWeek: boolean;
  notes: string[];
  /**
   * When the block or the race week replaces the session outright rather than
   * scaling it, this is what you actually do. Non-null means ignore the day's
   * own exercise list.
   */
  replaces: { title: string; exercises: Exercise[] } | null;
};

/** Race week turns Friday into a 25-minute wake-up, not a scaled leg day. */
const PRIMING: Exercise[] = [
  { name: 'Trap bar jump', sets: '3×3 @ 30%', note: 'Fast. The bar should feel light and leave the floor quickly.' },
  { name: 'Split jump', sets: '3×3', note: 'Land quietly. Quality only — you are waking the nervous system, not training it.' },
  { name: 'Sled push', sets: '2×20 m', note: 'Brisk, not brutal.' },
];

/**
 * Today's session, with the block's prescription written into it and the race
 * week override applied. `rung` comes from the knee engine, not from the block —
 * the leg has the final say on the plyometric block.
 */
export function prescribe(iso: string, day: GymDay, rung: Rung, plyoSuspended = false): Prescribed {
  const b = blockFor(iso);
  const race = isRaceWeek(iso);
  const notes: string[] = [];

  let compounds = b.compounds;
  const isolationScale = b.n <= 4 ? 1 : b.n <= 6 ? 0.7 : 0.55;
  let replaces: Prescribed['replaces'] = null;

  if (race) {
    if (day.key === 'push') { compounds = `${b.compounds} — cut the top set`; notes.push('Race week: keep the movement, lose the fatigue.'); }
    if (day.key === 'lowerB') {
      compounds = '3×3 @ 30%, speed only';
      replaces = { title: 'Priming session — 25 min', exercises: PRIMING };
      notes.push('Race week: Day 4 is not a leg day. It is a 25-minute wake-up that adds no fatigue — and the plyometric block comes out entirely.');
    }
    if (day.key === 'pull') notes.push('Race week: Day 5 is dropped. You will not miss one week of it.');
    if (day.key === 'cond') notes.push('Race week: sauna only, no plunge. Long cold pre-race leaves you flat.');
    if (day.key === 'lowerA') notes.push('Race week: Day 1 as normal — furthest point from the race. Load it here or nowhere.');
  }

  if (b.n === 7 && (day.key === 'push' || day.key === 'pull')) {
    notes.push('Block 7: Push and Pull merge into one upper day. Pick the movements you miss most.');
  }
  if (b.n === 6 && (day.key === 'lowerA' || day.key === 'lowerB')) {
    notes.push('Block 6: contrast pairs — a heavy double, ninety seconds, then a jump. Same bar, different intent.');
  }
  if (b.n === 9) notes.push('Taper: speed only. Nothing that leaves a mark.');

  if (plyoSuspended && day.key === 'lowerB') {
    notes.push('Plyometric block suspended — the stop rule fired. Everything else in the session stands.');
  }

  const plyo = day.key === 'lowerB' && !replaces && !plyoSuspended ? LADDER[rung - 1].work : [];

  return { day, compounds, isolationScale, plyo, raceWeek: race, notes, replaces };
}

/** The gym day scheduled on a date, or null. */
export function gymDayOn(iso: string): GymDay | null {
  const b = blockFor(iso);
  const wd = dow(iso);
  return daysInBlock(b).find((d) => d.weekday === wd) ?? null;
}

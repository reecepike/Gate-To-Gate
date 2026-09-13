/**
 * The calendar spine: blocks, races, the post-op clock and the bodyweight ramp.
 *
 * Everything else in the app reads its context from here, so that a date only
 * ever has to be interpreted once. Dates are calendar days ('YYYY-MM-DD'),
 * never instants — a timezone is exactly the thing that puts Wednesday's gates
 * session on a Tuesday.
 */

export const SURGERY = '2025-09-04';   // ACL reconstruction + meniscus repair + LET
export const CHAMPS = '2027-07-24';    // British Championships, date provisional
export const PROG_START = '2026-08-31'; // Monday of programme week 1

/* --------------------------------------------------------------- dates */

export function toIso(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Parse a calendar day into a local-noon Date — noon so DST can never shift it. */
export function fromIso(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function addDays(iso: string, n: number): string {
  const d = fromIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((fromIso(to).getTime() - fromIso(from).getTime()) / 86400000);
}

/** 1 = Monday … 7 = Sunday. */
export function dow(iso: string): number {
  const d = fromIso(iso).getDay();
  return d === 0 ? 7 : d;
}

export function mondayOf(iso: string): string {
  return addDays(iso, 1 - dow(iso));
}

export function fmt(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  return fromIso(iso).toLocaleDateString('en-GB', opts);
}

export function fmtLong(iso: string): string {
  return fromIso(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Programme week number, 1-based. Week 1 is the week of PROG_START. */
export function weekFor(iso: string): number {
  return Math.floor(daysBetween(PROG_START, mondayOf(iso)) / 7) + 1;
}

export function weekStart(week: number): string {
  return addDays(PROG_START, (week - 1) * 7);
}

/* -------------------------------------------------------------- blocks */

export type Block = {
  n: number;
  name: string;
  short: string;
  from: string;
  to: string;
  weeks: number;
  brief: string;
  targets: string[];
  /** Lifting days per week in this block. */
  gymDays: number;
  /** How the compound lifts are prescribed here. */
  compounds: string;
  /** What happens to the isolation / physique work. */
  isolation: string;
  /** The highest plyometric rung this block permits. */
  rung: 1 | 2 | 3 | 4;
};

export const BLOCKS: Block[] = [
  {
    n: 1, name: 'Race Cluster', short: 'Races', from: '2026-08-31', to: '2026-09-27', weeks: 4, gymDays: 4,
    compounds: '3×5 @ ~75%, never to failure', isolation: 'Full volume — it costs you nothing on race day. Drop Day 5 in race weeks.', rung: 1,
    brief:
      'Three race weekends in four weeks, so there is nothing to build here. Gym drops to maintenance: keep the movements, lose the fatigue, arrive at every Saturday without a trace of soreness. Use the races as diagnostics — where does the left leg go quiet, and where does confidence run out?',
    targets: ['Hold 70 kg', 'Baseline test done', 'Plyo Rung 1', 'Landing quality over height'],
  },
  {
    n: 2, name: 'Foundation & Mass', short: 'Foundation', from: '2026-09-28', to: '2026-11-08', weeks: 6, gymDays: 5,
    compounds: '4×8 @ ~70%, 3 s lowering', isolation: 'Peak. Highest volume of the year, top of every rep range. This is the mass block.', rung: 1,
    brief:
      'The real start. Highest training volume of the year and the point where the surplus opens up. Reps in the 8–10 range build the tissue that everything later gets to express. Expect the early kilos to come quickly — you are reclaiming what the injury took, not building from nothing.',
    targets: ['72.5 kg by 8 Nov', '4×8 @ 70%', 'Plyo Rung 1', 'LSI > 90%'],
  },
  {
    n: 3, name: 'Strength I', short: 'Strength I', from: '2026-11-09', to: '2026-12-20', weeks: 6, gymDays: 5,
    compounds: '4×5 @ ~80%', isolation: 'Held at full volume. Compounds get heavier; isolation stays where it is.', rung: 2,
    brief:
      'Implode sits in week one, so that week is a mini-taper and the block proper starts on the 16th. Then load goes up and reps come down. You will feel heavy and slightly slow through this block. That is correct and it is temporary.',
    targets: ['74 kg by 20 Dec', '4×5 @ 80%', 'Plyo Rung 2', 'LSI > 95%'],
  },
  {
    n: 4, name: 'Strength II', short: 'Strength II', from: '2026-12-21', to: '2027-01-31', weeks: 6, gymDays: 5,
    compounds: '5×3 @ ~87%, maximal intent', isolation: 'Held. Heaviest compounds of the year, same delt and arm work.', rung: 3,
    brief:
      'The heaviest block of the year, with Christmas inside it. Hold the line over the festive fortnight rather than writing it off and making it up in January. Reactive work steps to Rung 3 — this is where the leg starts behaving like a racer’s again.',
    targets: ['75.5 kg by 31 Jan', '5×3 @ 87%', 'Plyo Rung 3', 'LSI > 96%'],
  },
  {
    n: 5, name: 'Winter Engine', short: 'Engine', from: '2027-02-01', to: '2027-03-14', weeks: 6, gymDays: 4,
    compounds: '3×5 @ ~78%, maintenance', isolation: 'Reduced ~30%. Aerobic work is the priority; Day 3 merges into the run week.', rung: 3,
    brief:
      'The quietest stretch of the racing year, so it is the only sensible place to chase the 5 k and the swim. Strength holds at maintenance while aerobic work steps up to three sessions a week. Ends on 13 March with the full benchmark battery — your original ‘race fit’ date, now a checkpoint you can measure rather than a finish line.',
    targets: ['77 kg by 14 Mar', '5 k time trial', 'Strength maintained', 'March benchmark day'],
  },
  {
    n: 6, name: 'Power Conversion', short: 'Conversion', from: '2027-03-15', to: '2027-04-25', weeks: 6, gymDays: 4,
    compounds: '3×2 @ ~90% paired with jumps', isolation: 'Reduced. Contrast pairs on lower days; upper work holds.', rung: 4,
    brief:
      'Turn eleven weeks of strength into speed. Contrast pairs — a heavy double, ninety seconds, then a jump. Running drops back to one maintenance session; you banked that fitness in Block 5 and it keeps for months. Plyo goes to Rung 4.',
    targets: ['78.5 kg', 'Contrast method', 'Plyo Rung 4', 'Running to maintenance'],
  },
  {
    n: 7, name: 'Pre-Season Specific', short: 'Pre-season', from: '2027-04-26', to: '2027-06-06', weeks: 6, gymDays: 3,
    compounds: '3×3 @ ~85%, fast and short', isolation: 'Push and Pull merge into one upper day. The slope leads now.', rung: 4,
    brief:
      'Slope volume becomes the priority and the gym starts serving it rather than leading it. Book Stoke weekly if you can get it. Gym drops to three sessions, all short and fast. Every session now has to answer: does this make me quicker between two gates?',
    targets: ['79.5 kg', 'Stoke weekly', '3 gym sessions', 'Race simulation runs'],
  },
  {
    n: 8, name: 'Race Season', short: 'Season', from: '2027-06-07', to: '2027-07-11', weeks: 5, gymDays: 2,
    compounds: '2×4 @ ~80%, maintain', isolation: 'One lower, one upper. No soreness, no new exercises.', rung: 4,
    brief:
      'Race into form. Slot in whatever the summer calendar offers — every start is a rehearsal for July. Gym is two maintenance sessions a week, no soreness, no experiments. Nothing new gets introduced from here on.',
    targets: ['80 kg', 'Race into form', '2 gym sessions', 'Zero new stimuli'],
  },
  {
    n: 9, name: 'Taper & Champs', short: 'Taper', from: '2027-07-12', to: '2027-07-25', weeks: 2, gymDays: 2,
    compounds: '2×2 @ ~85%, speed only', isolation: 'Half of Block 8. Fresh beats fit.', rung: 4,
    brief:
      'Half the volume, all of the intensity. Short, sharp, fast, and nothing that leaves a mark. Sauna yes, long cold no. You cannot get fitter in a fortnight — you can only arrive fresh or arrive tired.',
    targets: ['79–80 kg', 'Fresh over fit', 'Sharpen only', 'Win it'],
  },
];

export function blockFor(iso: string): Block {
  for (const b of BLOCKS) if (iso >= b.from && iso <= b.to) return b;
  return iso < BLOCKS[0].from ? BLOCKS[0] : BLOCKS[BLOCKS.length - 1];
}

/** How far through the current block, 0–1. */
export function blockProgress(iso: string): number {
  const b = blockFor(iso);
  const span = daysBetween(b.from, b.to) + 1;
  const done = daysBetween(b.from, iso) + 1;
  return Math.max(0, Math.min(1, done / span));
}

/* --------------------------------------------------------------- races */

export type Race = {
  day: string;
  end: string;
  name: string;
  venue: string;
  aim: string;
  /** Not a race — a test day. */
  test?: boolean;
  target?: boolean;
};

export const RACES: Race[] = [
  { day: '2026-09-04', end: '2026-09-04', name: 'One year post-op', venue: 'Not a race — baseline test day', aim: 'Full symmetry battery. The number everything else gets measured against.', test: true },
  { day: '2026-09-12', end: '2026-09-13', name: 'Welsh Championships', venue: 'Dryslope', aim: 'Baseline' },
  { day: '2026-09-20', end: '2026-09-20', name: 'Llandudno Club National', venue: 'Llandudno', aim: 'Apply one fix' },
  { day: '2026-09-26', end: '2026-09-27', name: 'Irish Nationals', venue: 'TBC', aim: 'Optional' },
  { day: '2026-11-15', end: '2026-11-15', name: 'Implode Club National', venue: 'TBC', aim: 'Mid-build check' },
  { day: '2027-03-13', end: '2027-03-13', name: 'March checkpoint', venue: 'Not a race — a test day', aim: 'Your original ‘race fit’ date. Full benchmark battery.', test: true },
  { day: '2027-07-24', end: '2027-07-25', name: 'British Championships', venue: 'Date TBC — 25 July this year', aim: 'The target', target: true },
];

/** The next real race after (or on) `iso`, ignoring test days and the Champs. */
export function nextRace(iso: string): Race | null {
  return RACES.find((r) => r.end >= iso && !r.test && !r.target) ?? null;
}

export function nextAnything(iso: string): Race | null {
  return RACES.find((r) => r.end >= iso) ?? null;
}

/** True when `iso` falls in a week containing a race — the override week. */
export function isRaceWeek(iso: string): boolean {
  const mon = mondayOf(iso);
  const sun = addDays(mon, 6);
  return RACES.some((r) => !r.test && r.day <= sun && r.end >= mon);
}

export function raceThisWeek(iso: string): Race | null {
  const mon = mondayOf(iso);
  const sun = addDays(mon, 6);
  return RACES.find((r) => !r.test && r.day <= sun && r.end >= mon) ?? null;
}

/* -------------------------------------------------------- post-op clock */

export function monthsPostOp(iso: string): number {
  return daysBetween(SURGERY, iso) / 30.44;
}

/* ---------------------------------------------------------- bodyweight */

/**
 * The ramp is 70 → 80 kg across 47 weeks, roughly 0.21 kg a week, but it is not
 * a straight line: the early kilos come back quickly and the taper holds flat.
 * These are the block-end checkpoints; everything between is interpolated.
 */
const WEIGHT_POINTS: [string, number][] = [
  ['2026-08-31', 70.0],
  ['2026-09-27', 70.0],
  ['2026-11-08', 72.5],
  ['2026-12-20', 74.0],
  ['2027-01-31', 75.5],
  ['2027-03-14', 77.0],
  ['2027-04-25', 78.5],
  ['2027-06-06', 79.5],
  ['2027-07-11', 80.0],
  ['2027-07-25', 80.0],
];

export function targetWeight(iso: string): number {
  const pts = WEIGHT_POINTS;
  if (iso <= pts[0][0]) return pts[0][1];
  if (iso >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 1; i < pts.length; i++) {
    if (iso <= pts[i][0]) {
      const [d0, w0] = pts[i - 1];
      const [d1, w1] = pts[i];
      const span = daysBetween(d0, d1) || 1;
      const t = daysBetween(d0, iso) / span;
      return Math.round((w0 + (w1 - w0) * t) * 10) / 10;
    }
  }
  return 80;
}

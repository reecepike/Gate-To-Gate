/**
 * Long-term goals, and honest progress towards them.
 *
 * Two things make goal progress bars lie, and both are avoided here.
 *
 * The first is treating "no data yet" as zero. A handicap goal with no rounds
 * logged is not 0% of the way to a 10 handicap — it is unmeasured, and a bar
 * sitting at zero reads as failure rather than as a blank. Unmeasured goals say
 * so.
 *
 * The second is assuming bigger is better. Half of these go the other way: an
 * O-Barts points total, a golf handicap and a race position all improve by
 * getting smaller, and a progress calculation that does not know that will show
 * the athlete going backwards every time he improves.
 */

export type Goal = {
  id: number;
  slug: string | null;
  title: string;
  area: 'ski' | 'business' | 'brand' | 'golf' | 'fitness' | 'money' | 'life';
  metric: string | null;
  unit: string | null;
  start_value: number | null;
  current_value: number | null;
  target_value: number | null;
  lower_better: boolean;
  target_date: string | null;
  status: 'active' | 'paused' | 'done' | 'archived';
  sort: number;
  notes: string | null;
};

export type Milestone = {
  id: number;
  goal_id: number;
  label: string;
  value: number | null;
  sort: number;
  hit_on: string | null;
};

export type GoalProgress = {
  goal: Goal;
  /** 0–100, or null when there is nothing to measure. */
  pct: number | null;
  measured: boolean;
  currentLabel: string;
  targetLabel: string;
  /** The milestone just reached, and the one being chased. */
  hit: Milestone | null;
  next: Milestone | null;
  /** Change over the window supplied, in the goal's own units. */
  delta: number | null;
  deltaLabel: string | null;
  /** One line: what would actually move this. */
  action: string;
};

function fmtValue(v: number | null, unit: string | null): string {
  if (v == null) return '—';
  const n = Number.isInteger(v) ? v.toLocaleString('en-GB') : v.toFixed(1);
  if (!unit) return n;
  if (unit === '£') return `£${n}`;
  if (unit === '£/mo') return `£${n}/mo`;
  return `${n} ${unit}`;
}

const ACTIONS: Record<string, string> = {
  ski: 'Race results and gate sessions move this. Nothing else does.',
  business: 'Client revenue under management. Pitches and retention, not hours.',
  brand: 'Posting. One piece of content a week beats a burst and a month of silence.',
  golf: 'Rounds logged with a score. Four cards and the handicap starts telling the truth.',
  fitness: 'Top sets in the gym log. Progressive overload, tracked.',
  money: 'Anything saved towards it, logged on the Money page.',
  life: 'Whatever you decided this needs.',
};

export function progressOf(
  goal: Goal,
  milestones: Milestone[] = [],
  history: { day: string; value: number }[] = [],
): GoalProgress {
  const ms = milestones
    .filter((m) => m.goal_id === goal.id)
    .sort((a, b) => a.sort - b.sort);

  const cur = goal.current_value;
  const target = goal.target_value;
  const measured = cur != null && target != null;

  let pct: number | null = null;
  if (measured) {
    // The baseline is the start value where one was recorded, otherwise the
    // first thing ever logged — that is the only honest zero point.
    const start = goal.start_value ?? history[history.length - 1]?.value ?? null;
    if (start == null || start === target) {
      // No baseline: fall back on how close the current value is to the target,
      // which is cruder but never wrong in direction.
      pct = goal.lower_better
        ? Math.round(Math.max(0, Math.min(100, (target! / Math.max(cur!, target!)) * 100)))
        : Math.round(Math.max(0, Math.min(100, (cur! / target!) * 100)));
    } else {
      const span = target! - start;
      const done = cur! - start;
      pct = Math.round(Math.max(0, Math.min(100, (done / span) * 100)));
    }
  }

  // Milestones are ordered easiest-first, so the last one cleared is the one
  // reached and the next uncleared one is what is being chased.
  const cleared = (m: Milestone): boolean => {
    if (m.hit_on) return true;
    if (m.value == null || cur == null) return false;
    return goal.lower_better ? cur <= m.value : cur >= m.value;
  };
  const hitList = ms.filter(cleared);
  const hit = hitList.length ? hitList[hitList.length - 1] : null;
  const next = ms.find((m) => !cleared(m)) ?? null;

  let delta: number | null = null;
  let deltaLabel: string | null = null;
  if (history.length >= 2 && cur != null) {
    const oldest = history[history.length - 1].value;
    delta = Math.round((cur - oldest) * 10) / 10;
    if (delta !== 0) {
      const better = goal.lower_better ? delta < 0 : delta > 0;
      deltaLabel = `${delta > 0 ? '+' : ''}${delta}${goal.unit && goal.unit !== '£' ? ` ${goal.unit}` : ''} ${better ? 'the right way' : 'the wrong way'}`;
    } else {
      deltaLabel = 'flat';
    }
  }

  return {
    goal,
    pct,
    measured,
    currentLabel: measured ? fmtValue(cur, goal.unit) : 'Not measured yet',
    targetLabel: fmtValue(target, goal.unit),
    hit,
    next,
    delta,
    deltaLabel,
    action: measured
      ? (ACTIONS[goal.area] ?? 'Log something against it and this becomes useful.')
      : `Nothing logged against this yet. ${ACTIONS[goal.area] ?? ''}`.trim(),
  };
}

/**
 * The goals a day's work actually served.
 *
 * Deliberately conservative: a block only counts if it names a goal or its kind
 * maps unambiguously onto one. Crediting every hour of work to "£20k/month"
 * would make the number meaningless within a week.
 */
export function goalsTouchedBy(
  blocks: { kind: string; goalId: number | null; status: string }[],
  goals: Goal[],
): number[] {
  const out = new Set<number>();
  const byArea = (area: Goal['area']) => goals.find((g) => g.area === area && g.status === 'active');

  for (const b of blocks) {
    if (b.status !== 'done') continue;
    if (b.goalId) { out.add(b.goalId); continue; }
    const map: Partial<Record<string, Goal['area']>> = {
      train: 'fitness', ski: 'ski', golf: 'golf', brand: 'brand',
    };
    const area = map[b.kind];
    if (!area) continue;
    const g = byArea(area);
    if (g) out.add(g.id);
  }
  return [...out];
}

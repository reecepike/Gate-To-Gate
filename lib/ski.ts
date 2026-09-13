/**
 * Ski racing: results, formats and readiness.
 *
 * Two race formats, and they do not add up the same way. Getting this wrong
 * would quietly corrupt every result in the log, so it is the first thing in
 * the file and it is tested.
 *
 *   CLUB NATIONALS   three runs. The result is the better of runs 1 and 2,
 *                    plus run 3. A blown second run costs nothing if the first
 *                    was clean — which is exactly why people attack run 2.
 *
 *   CHAMPIONSHIP     two runs on different courses, both of which count.
 *                    Run 1 + run 2. There is nowhere to hide.
 *
 * O-Barts points are entered by hand. There is a published formula, but it
 * depends on the field and on penalties this app does not have, and a number
 * invented here would look exactly like a real one. Better a blank than a
 * plausible lie.
 */

export type Surface = 'dry' | 'snow';
export type RaceFormat = 'club' | 'champs';

export type SkiRun = {
  id?: number;
  run_no: number;
  time_sec: number | null;
  status: 'ok' | 'dnf' | 'dsq' | 'dns';
  penalty: number | null;
  note: string | null;
};

export type SkiRace = {
  id: number;
  day: string;
  name: string;
  venue: string | null;
  surface: Surface;
  format: RaceFormat;
  discipline: string;
  position: number | null;
  field_size: number | null;
  winner_sec: number | null;
  total_sec: number | null;
  obarts: number | null;
  notes: string | null;
};

export const FORMATS: { key: RaceFormat; label: string; runs: number; rule: string }[] = [
  {
    key: 'club', label: 'Club National', runs: 3,
    rule: 'Best of run 1 and run 2, plus run 3.',
  },
  {
    key: 'champs', label: 'Championship', runs: 2,
    rule: 'Run 1 plus run 2, on different courses. Both count.',
  },
];

export type RaceResult = {
  total: number | null;
  /** Which runs actually contributed, for showing the working. */
  counted: number[];
  dropped: number[];
  complete: boolean;
  /** Why there is no total, when there is no total. */
  problem: string | null;
  explain: string;
};

/**
 * The total, by format. Returns null rather than guessing whenever a counting
 * run is missing or did not finish — a DNF in a run that counts means there is
 * no time, and showing a partial sum as though it were a result is worse than
 * showing nothing.
 */
export function raceTotal(format: RaceFormat, runs: SkiRun[]): RaceResult {
  const by = (n: number) => runs.find((r) => r.run_no === n) ?? null;
  const timeOf = (r: SkiRun | null): number | null =>
    r && r.status === 'ok' && r.time_sec != null ? r.time_sec + (r.penalty ?? 0) : null;

  if (format === 'champs') {
    const t1 = timeOf(by(1));
    const t2 = timeOf(by(2));
    if (t1 == null || t2 == null) {
      const missing = [t1 == null ? 1 : null, t2 == null ? 2 : null].filter(Boolean);
      return {
        total: null, counted: [], dropped: [], complete: false,
        problem: by(missing[0] as number)?.status && by(missing[0] as number)!.status !== 'ok'
          ? `Run ${missing.join(' and ')} did not finish, and in a championship both runs count. No result.`
          : `Run ${missing.join(' and ')} not entered yet.`,
        explain: 'Championship: run 1 + run 2, both on different courses.',
      };
    }
    return {
      total: Math.round((t1 + t2) * 100) / 100,
      counted: [1, 2], dropped: [], complete: true, problem: null,
      explain: `Run 1 (${t1.toFixed(2)}) + run 2 (${t2.toFixed(2)}). Both count — that is the championship format.`,
    };
  }

  // Club National: best of 1 and 2, plus 3.
  const t1 = timeOf(by(1));
  const t2 = timeOf(by(2));
  const t3 = timeOf(by(3));
  const best = t1 != null && t2 != null ? Math.min(t1, t2) : (t1 ?? t2);

  if (best == null || t3 == null) {
    return {
      total: null, counted: [], dropped: [], complete: false,
      problem: best == null
        ? 'Neither run 1 nor run 2 produced a time. Nothing to count.'
        : 'Run 3 is missing, and it always counts.',
      explain: 'Club National: the better of run 1 and run 2, plus run 3.',
    };
  }

  const keptFirst = t1 != null && t2 != null ? (t1 <= t2 ? 1 : 2) : (t1 != null ? 1 : 2);
  const droppedFirst = t1 != null && t2 != null ? (keptFirst === 1 ? 2 : 1) : null;

  return {
    total: Math.round((best + t3) * 100) / 100,
    counted: [keptFirst, 3],
    dropped: droppedFirst ? [droppedFirst] : [],
    complete: true,
    problem: null,
    explain:
      `Run ${keptFirst} (${best.toFixed(2)}) was the better of the first two, plus run 3 (${t3.toFixed(2)}).` +
      (droppedFirst ? ` Run ${droppedFirst} is dropped — that is the format, and it is why run 2 is the one to attack.` : ''),
  };
}

/** Percentage behind the winner. The number that actually travels between venues. */
export function behindPct(total: number | null, winner: number | null): number | null {
  if (total == null || winner == null || winner <= 0) return null;
  return Math.round(((total - winner) / winner) * 1000) / 10;
}

export function resultLine(race: SkiRace, runs: SkiRun[]): string {
  const r = raceTotal(race.format, runs);
  if (!r.complete) return r.problem ?? 'Incomplete.';
  const pct = behindPct(r.total, race.winner_sec);
  const bits = [`${r.total!.toFixed(2)} s`];
  if (race.position) bits.push(race.field_size ? `${race.position} of ${race.field_size}` : `P${race.position}`);
  if (pct != null) bits.push(`${pct > 0 ? '+' : ''}${pct}% on the winner`);
  if (race.obarts != null) bits.push(`${race.obarts} O-Barts`);
  return bits.join(' · ');
}

/* ------------------------------------------------------------- readiness */

export type SkiReadiness = {
  score: number | null;
  band: 'green' | 'amber' | 'red' | null;
  parts: { key: string; label: string; value: number | null; note: string }[];
  /** The weakest area, named, with what to do about it. */
  weakest: string | null;
  recommendation: string;
  confidence: 'full' | 'partial' | 'insufficient';
};

export type SkiInputs = {
  /** Gate and technical sessions in the last 28 days. */
  gateSessions: number;
  technicalSessions: number;
  /** Mean confidence 1–10 across recent ski sessions. */
  confidence: number | null;
  /** Gym sessions in the last 14 days, and whether the plyo ladder is live. */
  gymSessions14: number;
  plyoRung: number;
  plyoSuspended: boolean;
  /** Limb symmetry, most recent. */
  lsi: number | null;
  /** Mean readiness score over the last 14 days. */
  readiness14: number | null;
  /** Mean sleep hours over the last 14 days. */
  sleep14: number | null;
  /** Most recent races: percentage behind the winner, newest first. */
  recentBehind: number[];
};

/**
 * Where the skiing actually is — technical, physical, performance, lifestyle.
 *
 * This is current ability and preparedness, not a count of completed tasks. It
 * only scores what there is evidence for, and it names the weakest of the four
 * rather than averaging them into a number that hides the answer.
 */
export function skiReadiness(i: SkiInputs): SkiReadiness {
  const parts: SkiReadiness['parts'] = [];
  const clamp = (x: number) => Math.max(0, Math.min(1, x));

  /* technical — time on snow and on gates, and how it felt */
  {
    const sessions = i.gateSessions + i.technicalSessions * 0.6;
    let v: number | null = null;
    let note = 'No ski sessions logged in the last four weeks.';
    if (sessions > 0 || i.confidence != null) {
      // Four gate sessions a month is the plan's baseline.
      const vol = clamp(sessions / 4);
      const conf = i.confidence != null ? clamp((i.confidence - 1) / 9) : null;
      v = conf != null ? vol * 0.6 + conf * 0.4 : vol;
      note = `${i.gateSessions} gate session${i.gateSessions === 1 ? '' : 's'} in four weeks`
        + (i.confidence != null ? `, confidence averaging ${i.confidence.toFixed(1)}/10.` : '.');
    }
    parts.push({ key: 'technical', label: 'Technical', value: v, note });
  }

  /* physical — strength work, the plyo ladder and symmetry */
  {
    const bits: number[] = [];
    const notes: string[] = [];
    if (i.gymSessions14 > 0) {
      bits.push(clamp(i.gymSessions14 / 8));
      notes.push(`${i.gymSessions14} gym sessions in a fortnight`);
    }
    bits.push(i.plyoSuspended ? 0.3 : clamp(i.plyoRung / 4));
    notes.push(i.plyoSuspended ? 'plyometrics suspended' : `plyo at rung ${i.plyoRung} of 4`);
    if (i.lsi != null) {
      bits.push(clamp((i.lsi - 75) / 25));
      notes.push(`limb symmetry ${i.lsi.toFixed(0)}%`);
    }
    parts.push({
      key: 'physical',
      label: 'Physical',
      value: bits.length ? bits.reduce((a, b) => a + b, 0) / bits.length : null,
      note: notes.join(', ') + '.',
    });
  }

  /* performance — what the results actually say */
  {
    let v: number | null = null;
    let note = 'No races logged yet, so there is nothing to measure form against.';
    if (i.recentBehind.length) {
      const latest = i.recentBehind[0];
      // 0% behind is a win; 12% behind is a long way off the pace.
      v = clamp(1 - latest / 12);
      const trendBits = i.recentBehind.slice(0, 3);
      const improving = trendBits.length >= 2 && trendBits[0] < trendBits[trendBits.length - 1];
      note = `Last race ${latest > 0 ? '+' : ''}${latest}% on the winner`
        + (trendBits.length >= 2 ? `, and ${improving ? 'closing' : 'not closing'} over the last ${trendBits.length}.` : '.');
    }
    parts.push({ key: 'performance', label: 'Performance', value: v, note });
  }

  /* lifestyle — sleep and recovery, which is where most of it is won */
  {
    const bits: number[] = [];
    const notes: string[] = [];
    if (i.readiness14 != null) { bits.push(clamp(i.readiness14 / 100)); notes.push(`readiness averaging ${Math.round(i.readiness14)}`); }
    if (i.sleep14 != null) { bits.push(clamp((i.sleep14 - 5.5) / 3)); notes.push(`${i.sleep14.toFixed(1)} h sleep`); }
    parts.push({
      key: 'lifestyle',
      label: 'Lifestyle',
      value: bits.length ? bits.reduce((a, b) => a + b, 0) / bits.length : null,
      note: notes.length ? notes.join(', ') + '.' : 'No check-ins logged.',
    });
  }

  const known = parts.filter((p) => p.value != null);
  if (known.length < 2) {
    return {
      score: null, band: null, parts, weakest: null,
      confidence: 'insufficient',
      recommendation:
        'Not enough logged to say where the skiing is. Two or three gate sessions and a couple of check-ins and this starts telling you something real.',
    };
  }

  const score = Math.round((known.reduce((a, p) => a + (p.value ?? 0), 0) / known.length) * 100);
  const band: 'green' | 'amber' | 'red' = score >= 75 ? 'green' : score >= 55 ? 'amber' : 'red';
  const weakestPart = known.reduce((m, p) => ((p.value ?? 1) < (m.value ?? 1) ? p : m));
  const strongest = known.reduce((m, p) => ((p.value ?? 0) > (m.value ?? 0) ? p : m));

  const REC: Record<string, string> = {
    technical: 'Gate time is the gap. Everything else is ahead of it, and no amount of gym work closes a technical deficit.',
    physical: 'The body is behind the skiing. Strength and the plyometric ladder are what turn good technique into speed out of the gate.',
    performance: 'Training is in better shape than the results. That usually means race execution rather than fitness — start protocol, first four gates, and what happens when it goes wrong.',
    lifestyle: 'Sleep and recovery are the weak link, and they are the cheapest thing on this list to fix.',
  };

  return {
    score,
    band,
    parts,
    weakest: weakestPart.label,
    confidence: known.length === parts.length ? 'full' : 'partial',
    recommendation:
      known.length >= 3 && strongest.key !== weakestPart.key
        ? `${strongest.label.toLowerCase()} is currently ahead of ${weakestPart.label.toLowerCase()}. ${REC[weakestPart.key]}`
        : REC[weakestPart.key],
  };
}

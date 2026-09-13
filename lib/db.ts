import postgres from 'postgres';

import type { Readiness } from './readiness';
import type { KneeLog } from './knee';
import type { Job } from './work';
import type { WorkSlot } from './week';


type Sql = ReturnType<typeof postgres>;

declare global {
  // eslint-disable-next-line no-var
  var __sql: Sql | undefined;
}

/**
 * The connection is created lazily, on first query — never at import time.
 *
 * `next build` imports every route module to read its config, and a build
 * machine has no reason to hold database credentials. Connecting (or throwing)
 * at import time turns a missing environment variable into a failed build
 * rather than a clear runtime error, which is a much worse way to find out.
 */
/**
 * Hosted Postgres providers hand you a libpq-style URL with query parameters
 * that postgres.js does not recognise — and it forwards anything unknown to the
 * server as a startup parameter, which Postgres then rejects outright. Neon
 * appends `channel_binding`, Supabase's pooler appends `pgbouncer`. Pasting
 * either string in unmodified fails with "unrecognized configuration
 * parameter". So: read the TLS mode, strip the client-side parameters, hand the
 * driver a clean URL.
 */
function parseConnection(raw: string): { url: string; ssl: 'require' | false } {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    // Not a URL we can parse — pass it through and let the driver complain.
    return { url: raw, ssl: raw.includes('sslmode=disable') ? false : 'require' };
  }

  const sslmode = u.searchParams.get('sslmode');
  for (const key of ['sslmode', 'channel_binding', 'pgbouncer', 'connect_timeout', 'target_session_attrs']) {
    u.searchParams.delete(key);
  }

  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1';
  const ssl: 'require' | false =
    sslmode === 'disable' ? false : sslmode ? 'require' : local ? false : 'require';

  return { url: u.toString(), ssl };
}

function connect(): Sql {
  if (global.__sql) return global.__sql;

  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      'DATABASE_URL is not set. On Vercel: Project → Settings → Environment Variables, ' +
        'ticked for Production, Preview and Development. ' +
        'Locally: copy .env.example to .env.local and fill it in.',
    );
  }

  const { url, ssl } = parseConnection(raw);

  const client = postgres(url, {
    ssl,
    max: 3,
    idle_timeout: 20,
  });

  global.__sql = client;
  return client;
}

/**
 * Behaves exactly like the postgres.js client — `sql`select …`` and
 * `sql.unsafe(…)` both work — but nothing connects until the first call.
 */
export const sql = new Proxy((() => {}) as unknown as Sql, {
  apply(_target, _thisArg, args: unknown[]) {
    return (connect() as unknown as (...a: unknown[]) => unknown)(...args);
  },
  get(_target, prop: string | symbol) {
    const client = connect() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === 'function'
      ? (value as (...a: unknown[]) => unknown).bind(client)
      : value;
  },
}) as Sql;


/* ------------------------------------------------------------------ types */

export type Settings = {
  id: number;
  name: string;
  champs_date: string;
  surgery_date: string;
  start_date: string;
  weight_kg: number;
  handicap: number | null;
  rpm_hours: number;
  updated_at: string;

  /* --- the day frame the planner works inside ---------------------- */
  wake_time: string;
  bed_time: string;
  sleep_target_h: number;
  /** Hours of RPM a normal working day owes — a budget, not a fixed block. */
  rpm_daily_h: number;
  /** Past this, more work makes the day worse rather than better. */
  work_cap_h: number;
  /** Minutes of unstructured time the day has to keep. */
  free_floor_min: number;
  obarts_points: number | null;
  golf_handicap: number | null;
};

export type SessionRow = {
  id: number;
  day: string;
  kind: string;
  gym_day: string | null;
  title: string | null;
  duration_min: number | null;
  rpe: number | null;
  detail: string | null;
  notes: string | null;
  completed: boolean;
};

export type Lift = {
  id: number;
  day: string;
  exercise: string;
  load_kg: number | null;
  reps: number | null;
  sets: number | null;
  side: string | null;
  note: string | null;
};

export type LsiRow = {
  id: number;
  day: string;
  test: string;
  left_val: number;
  right_val: number;
  lsi: number;
  note: string | null;
};

export type WorkLogRow = {
  id: number;
  day: string;
  job_id: number | null;
  minutes: number;
  note: string | null;
};

/* ------------------------------------------------------------- accessors */

/**
 * Every date here is a calendar day, never an instant. The driver hands DATE
 * columns back as Date objects, which reintroduces a timezone the data has not
 * got — and that is how Wednesday's gates session ends up on a Tuesday.
 * Normalise to 'YYYY-MM-DD' on the way out, once, here.
 */
function dstr(v: unknown): string {
  if (typeof v === 'string') return v.slice(0, 10);
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  return String(v ?? '').slice(0, 10);
}

function dnull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return dstr(v);
}

/** postgres.js returns numeric columns as strings. Nothing good comes of that. */
function n(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export async function getSettings(): Promise<Settings> {
  const rows = await sql<Settings[]>`select * from settings where id = 1`;
  if (!rows[0]) throw new Error('Settings row missing — run the setup SQL.');
  const s = rows[0];
  return {
    ...s,
    champs_date: dstr(s.champs_date),
    surgery_date: dstr(s.surgery_date),
    start_date: dstr(s.start_date),
    weight_kg: n(s.weight_kg) ?? 70,
    handicap: n(s.handicap),
    wake_time: s.wake_time ?? '07:30',
    bed_time: s.bed_time ?? '23:15',
    sleep_target_h: n(s.sleep_target_h) ?? 8.25,
    rpm_daily_h: n(s.rpm_daily_h) ?? 7,
    work_cap_h: n(s.work_cap_h) ?? 9,
    free_floor_min: Number(s.free_floor_min ?? 120),
    obarts_points: n(s.obarts_points),
    golf_handicap: n(s.golf_handicap),
  };
}

export async function getReadiness(day: string): Promise<Readiness | null> {
  const rows = await sql<Readiness[]>`select * from readiness where day = ${day}`;
  return rows[0] ? { ...rows[0], day: dstr(rows[0].day), sleep_h: n(rows[0].sleep_h), weight_kg: n(rows[0].weight_kg) } : null;
}

export async function recentReadiness(day: string, limit = 28): Promise<Readiness[]> {
  const rows = await sql<Readiness[]>`
    select * from readiness where day <= ${day} order by day desc limit ${limit}`;
  return rows.map((r) => ({ ...r, day: dstr(r.day), sleep_h: n(r.sleep_h), weight_kg: n(r.weight_kg) }));
}

export async function weightSeries(limit = 120): Promise<{ day: string; weight_kg: number }[]> {
  const rows = await sql<{ day: string; weight_kg: number }[]>`
    select day, weight_kg from readiness
    where weight_kg is not null order by day asc limit ${limit}`;
  return rows.map((r) => ({ day: dstr(r.day), weight_kg: n(r.weight_kg) ?? 0 }));
}

export async function recentKnee(day: string, limit = 40): Promise<KneeLog[]> {
  const rows = await sql<KneeLog[]>`
    select * from knee_log where day <= ${day} order by day desc limit ${limit}`;
  return rows.map((r) => ({ ...r, day: dstr(r.day) }));
}

export async function getKnee(day: string): Promise<KneeLog | null> {
  const rows = await sql<KneeLog[]>`select * from knee_log where day = ${day}`;
  return rows[0] ? { ...rows[0], day: dstr(rows[0].day) } : null;
}

export async function lsiRows(limit = 60): Promise<LsiRow[]> {
  const rows = await sql<LsiRow[]>`select * from lsi_tests order by day desc, test asc limit ${limit}`;
  return rows.map((r) => ({ ...r, day: dstr(r.day), left_val: n(r.left_val) ?? 0, right_val: n(r.right_val) ?? 0, lsi: n(r.lsi) ?? 0 }));
}

export async function sessionsBetween(from: string, to: string): Promise<SessionRow[]> {
  const rows = await sql<SessionRow[]>`
    select * from sessions where day >= ${from} and day <= ${to} order by day asc, id asc`;
  return rows.map((r) => ({ ...r, day: dstr(r.day) }));
}

export async function recentSessions(limit = 30): Promise<SessionRow[]> {
  const rows = await sql<SessionRow[]>`select * from sessions order by day desc, id desc limit ${limit}`;
  return rows.map((r) => ({ ...r, day: dstr(r.day) }));
}

export async function recentLifts(limit = 40): Promise<Lift[]> {
  const rows = await sql<Lift[]>`select * from lifts order by day desc, id desc limit ${limit}`;
  return rows.map((r) => ({ ...r, day: dstr(r.day), load_kg: n(r.load_kg) }));
}

export async function ticksFor(week: number): Promise<Record<string, boolean>> {
  const rows = await sql<{ task: string; done: boolean }[]>`
    select task, done from week_ticks where week = ${week}`;
  const out: Record<string, boolean> = {};
  for (const r of rows) out[r.task] = r.done;
  return out;
}

export async function allJobs(): Promise<Job[]> {
  const rows = await sql<Job[]>`
    select * from jobs where status <> 'done' order by created_at asc, id asc`;
  return rows.map((r) => ({
    ...r,
    due: dnull(r.due),
    last_touched: dnull(r.last_touched),
    created_at: dstr(r.created_at),
    value_gbp: n(r.value_gbp),
  }));
}

export async function doneJobs(limit = 40): Promise<Job[]> {
  const rows = await sql<Job[]>`
    select * from jobs where status = 'done' order by done_at desc nulls last, id desc limit ${limit}`;
  return rows.map((r) => ({
    ...r,
    due: dnull(r.due),
    last_touched: dnull(r.last_touched),
    created_at: dstr(r.created_at),
    value_gbp: n(r.value_gbp),
  }));
}

export async function getSlots(): Promise<WorkSlot[]> {
  const rows = await sql<WorkSlot[]>`select weekday, time, minutes, label, protected from work_slots order by weekday, time`;
  return rows;
}

export async function workLogBetween(from: string, to: string): Promise<WorkLogRow[]> {
  const rows = await sql<WorkLogRow[]>`
    select * from work_log where day >= ${from} and day <= ${to} order by day asc, id asc`;
  return rows.map((r) => ({ ...r, day: dstr(r.day) }));
}

/* ===================================================================
 *  The performance OS.
 *
 *  Calendar, planner, goals, and the tracking areas. Same conventions
 *  as everything above: dates come back as 'YYYY-MM-DD' strings, and
 *  numerics come back as numbers rather than the strings the driver
 *  hands over.
 * =================================================================== */

import type { CalEvent, Commitment, Block } from './planner';
import type { Goal, Milestone } from './goals';
import type { SkiRace, SkiRun } from './ski';

/* ---------------------------------------------------------- calendar */

export async function eventsBetween(from: string, to: string): Promise<CalEvent[]> {
  const rows = await sql<CalEvent[]>`
    select * from calendar_events
    where day <= ${to} and coalesce(end_day, day) >= ${from}
    order by day asc, start_at asc nulls first`;
  return rows.map((r) => ({ ...r, day: dstr(r.day), end_day: r.end_day ? dstr(r.end_day) : null }));
}

export async function eventsOn(day: string): Promise<CalEvent[]> {
  return eventsBetween(day, day);
}

export async function nextEvents(from: string, limit = 8): Promise<CalEvent[]> {
  const rows = await sql<CalEvent[]>`
    select * from calendar_events
    where coalesce(end_day, day) >= ${from}
    order by day asc, start_at asc nulls first
    limit ${limit}`;
  return rows.map((r) => ({ ...r, day: dstr(r.day), end_day: r.end_day ? dstr(r.end_day) : null }));
}

export async function getCommitments(): Promise<Commitment[]> {
  return sql<Commitment[]>`select * from commitments where active order by weekday, start_at`;
}

/* ----------------------------------------------------------- planner */

type BlockRow = {
  id: number; day: string; start_at: string; end_at: string; kind: string;
  title: string; detail: string | null; why: string | null;
  job_id: number | null; event_id: number | null; goal_id: number | null;
  locked: boolean; status: string; generated: boolean;
};

function toMinutes(t: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}
function toClock(mins: number): string {
  const t = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export type StoredBlock = Block & { id: number };

export async function blocksOn(day: string): Promise<StoredBlock[]> {
  const rows = await sql<BlockRow[]>`
    select * from plan_blocks where day = ${day} order by start_at asc`;
  return rows.map((r) => ({
    id: r.id,
    start: toMinutes(r.start_at),
    end: toMinutes(r.end_at),
    kind: r.kind as Block['kind'],
    title: r.title,
    detail: r.detail,
    why: r.why,
    jobId: r.job_id,
    eventId: r.event_id,
    goalId: r.goal_id,
    locked: r.locked,
    status: r.status as Block['status'],
    generated: r.generated,
  }));
}

/**
 * Write a generated day back, without disturbing anything the athlete
 * touched. Locked blocks and anything already marked done or skipped
 * are left exactly where they are — that is the whole contract of
 * automatic replanning, and breaking it once would end trust in it.
 */
export async function saveDay(day: string, blocks: Block[]): Promise<void> {
  await sql`
    delete from plan_blocks
    where day = ${day} and locked = false and status = 'planned' and generated = true`;
  for (const b of blocks) {
    if (b.locked) continue;
    await sql`
      insert into plan_blocks
        (day, start_at, end_at, kind, title, detail, why, job_id, event_id, goal_id, locked, status, generated)
      values
        (${day}, ${toClock(b.start)}, ${toClock(b.end)}, ${b.kind}, ${b.title},
         ${b.detail}, ${b.why}, ${b.jobId}, ${b.eventId}, ${b.goalId},
         ${b.locked}, ${b.status}, ${b.generated})
      on conflict (day, start_at, title) do nothing`;
  }
}

/* ------------------------------------------------------------- goals */

export async function allGoals(): Promise<Goal[]> {
  const rows = await sql<Goal[]>`select * from goals order by sort asc, id asc`;
  return rows.map((r) => ({
    ...r,
    target_date: r.target_date ? dstr(r.target_date) : null,
    start_value: n(r.start_value),
    current_value: n(r.current_value),
    target_value: n(r.target_value),
  }));
}

export async function allMilestones(): Promise<Milestone[]> {
  const rows = await sql<Milestone[]>`select * from goal_milestones order by goal_id, sort`;
  return rows.map((r) => ({ ...r, value: n(r.value), hit_on: r.hit_on ? dstr(r.hit_on) : null }));
}

export async function goalHistory(goalId: number, limit = 30): Promise<{ day: string; value: number }[]> {
  const rows = await sql<{ day: string; value: string }[]>`
    select day, value from goal_progress where goal_id = ${goalId}
    order by day desc limit ${limit}`;
  return rows.map((r) => ({ day: dstr(r.day), value: Number(r.value) }));
}

/* --------------------------------------------------------- ski racing */

export async function skiRaces(limit = 40): Promise<SkiRace[]> {
  const rows = await sql<SkiRace[]>`select * from ski_races order by day desc limit ${limit}`;
  return rows.map((r) => ({
    ...r, day: dstr(r.day),
    winner_sec: n(r.winner_sec), total_sec: n(r.total_sec), obarts: n(r.obarts),
  }));
}

export async function runsForRaces(ids: number[]): Promise<Record<number, SkiRun[]>> {
  if (!ids.length) return {};
  const rows = await sql<(SkiRun & { race_id: number })[]>`
    select * from ski_runs where race_id in ${sql(ids)} order by race_id, run_no`;
  const out: Record<number, SkiRun[]> = {};
  for (const r of rows) {
    (out[r.race_id] ??= []).push({ ...r, time_sec: n(r.time_sec), penalty: n(r.penalty) });
  }
  return out;
}

export type SkiSessionRow = {
  id: number; day: string; venue: string | null; surface: string; kind: string;
  duration_min: number | null; runs: number | null; focus: string | null;
  intensity: number | null; confidence: number | null; notes: string | null;
};

export async function skiSessions(limit = 40): Promise<SkiSessionRow[]> {
  const rows = await sql<SkiSessionRow[]>`select * from ski_sessions order by day desc limit ${limit}`;
  return rows.map((r) => ({ ...r, day: dstr(r.day) }));
}

/* -------------------------------------------------- golf, brand, money */

export type GolfRound = {
  id: number; day: string; course: string | null; holes: number;
  score: number | null; par: number | null; handicap: number | null; notes: string | null;
};

export async function golfRounds(limit = 40): Promise<GolfRound[]> {
  const rows = await sql<GolfRound[]>`select * from golf_rounds order by day desc limit ${limit}`;
  return rows.map((r) => ({ ...r, day: dstr(r.day), handicap: n(r.handicap) }));
}

export type BrandRow = {
  day: string; followers: number | null; posts: number | null; reels: number | null;
  views: number | null; engagement: number | null; minutes: number | null;
  leads: number | null; revenue_gbp: number | null; notes: string | null;
};

export async function brandRows(limit = 60): Promise<BrandRow[]> {
  const rows = await sql<BrandRow[]>`select * from brand_metrics order by day desc limit ${limit}`;
  return rows.map((r) => ({ ...r, day: dstr(r.day), revenue_gbp: n(r.revenue_gbp) }));
}

export type MoneyRow = {
  id: number; day: string; kind: string; category: string | null;
  label: string | null; amount_gbp: number; notes: string | null;
};

export async function moneyRows(limit = 120): Promise<MoneyRow[]> {
  const rows = await sql<MoneyRow[]>`select * from money_entries order by day desc, id desc limit ${limit}`;
  return rows.map((r) => ({ ...r, day: dstr(r.day), amount_gbp: Number(r.amount_gbp) }));
}

/* --------------------------------------------------------- day scores */

export type DayScoreRow = {
  day: string; score: number | null; band: string | null;
  parts: unknown; confidence: string; note: string | null;
};

export async function recentScores(day: string, limit = 14): Promise<DayScoreRow[]> {
  const rows = await sql<DayScoreRow[]>`
    select * from day_scores where day <= ${day} order by day desc limit ${limit}`;
  return rows.map((r) => ({ ...r, day: dstr(r.day) }));
}

export async function saveScore(day: string, score: number | null, band: string | null, parts: unknown, confidence: string, note: string | null): Promise<void> {
  await sql`
    insert into day_scores (day, score, band, parts, confidence, note)
    values (${day}, ${score}, ${band}, ${sql.json(parts as never)}, ${confidence}, ${note})
    on conflict (day) do update set
      score = excluded.score, band = excluded.band, parts = excluded.parts,
      confidence = excluded.confidence, note = excluded.note`;
}

/* ------------------------------------------------------ balance signal */

/**
 * How hard the last week has actually been, and how long since an evening
 * was genuinely his. Feeds the social-balance recommendation.
 */
export async function balanceSignal(day: string): Promise<{
  workMin7: number; trainMin7: number; freeMin7: number; daysSinceSocial: number;
}> {
  const from = dateMinus(day, 6);
  const [work, train, blocks] = await Promise.all([
    sql<{ m: string }[]>`select coalesce(sum(minutes),0) as m from work_log where day >= ${from} and day <= ${day}`,
    sql<{ m: string }[]>`select coalesce(sum(duration_min),0) as m from sessions where day >= ${from} and day <= ${day} and completed`,
    sql<{ day: string; kind: string; minutes: string }[]>`
      select day, kind, coalesce(sum(
        (substring(end_at from 1 for 2)::int * 60 + substring(end_at from 4 for 2)::int)
        - (substring(start_at from 1 for 2)::int * 60 + substring(start_at from 4 for 2)::int)
      ), 0) as minutes
      from plan_blocks
      where day >= ${dateMinus(day, 20)} and day <= ${day} and kind in ('free','social')
      group by day, kind order by day desc`,
  ]);

  const freeMin7 = blocks
    .filter((b) => b.day && dstr(b.day) >= from)
    .reduce((a, b) => a + Number(b.minutes), 0);

  // A social evening is one with a social block, or ninety-plus minutes free
  // after six. Absent any planner history, assume it has been a while — which
  // errs towards suggesting a night off, and that is the safer error.
  let daysSinceSocial = 99;
  for (const b of blocks) {
    if (b.kind !== 'social' && Number(b.minutes) < 90) continue;
    const d = Math.round((new Date(dstr(b.day) + 'T12:00:00Z').getTime() - new Date(day + 'T12:00:00Z').getTime()) / -86400000);
    if (d >= 0 && d < daysSinceSocial) daysSinceSocial = d;
  }

  return {
    workMin7: Number(work[0]?.m ?? 0),
    trainMin7: Number(train[0]?.m ?? 0),
    freeMin7,
    daysSinceSocial: daysSinceSocial === 99 ? 7 : daysSinceSocial,
  };
}

function dateMinus(iso: string, n2: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - n2);
  return d.toISOString().slice(0, 10);
}

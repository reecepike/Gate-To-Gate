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

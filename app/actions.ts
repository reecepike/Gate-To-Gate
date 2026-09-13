'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql, getSlots, recentReadiness } from '@/lib/db';
import { login as doLogin, logout as doLogout, currentUser } from '@/lib/auth';
import { assess, Readiness } from '@/lib/readiness';
import { toIso, weekFor } from '@/lib/plan';

/* ------------------------------------------------------------- helpers */

function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}
function num(fd: FormData, k: string): number | null {
  const s = str(fd, k);
  if (s === null) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function int(fd: FormData, k: string): number | null {
  const n = num(fd, k);
  return n === null ? null : Math.round(n);
}
function bool(fd: FormData, k: string): boolean {
  return fd.get(k) === 'on' || fd.get(k) === 'true';
}
function today(): string {
  return toIso(new Date());
}

async function requireUser() {
  const id = await currentUser();
  if (!id) redirect('/login');
  return id;
}

/* --------------------------------------------------------------- auth */

export async function loginAction(_prev: unknown, fd: FormData): Promise<{ error?: string }> {
  const email = str(fd, 'email');
  const password = str(fd, 'password');
  if (!email || !password) return { error: 'Email and password, please.' };
  const ok = await doLogin(email, password);
  if (!ok) return { error: 'That email and password do not match an account.' };
  redirect('/');
}

export async function logoutAction() {
  await doLogout();
  redirect('/login');
}

/* ---------------------------------------------------------- readiness */

export async function saveReadinessAction(fd: FormData) {
  await requireUser();
  const day = str(fd, 'day') ?? today();

  const entry = {
    day,
    sleep_h: num(fd, 'sleep_h'),
    sleep_q: int(fd, 'sleep_q'),
    rhr: int(fd, 'rhr'),
    weight_kg: num(fd, 'weight_kg'),
    legs: int(fd, 'legs'),
    stress: int(fd, 'stress'),
    motivation: int(fd, 'motivation'),
    work_load: int(fd, 'work_load'),
    illness: bool(fd, 'illness'),
    notes: str(fd, 'notes'),
  };

  const history = (await recentReadiness(day, 30)).filter((r) => r.day !== day);
  const v = assess({ ...entry, score: null, band: null } as Readiness, history);

  await sql`
    insert into readiness (day, sleep_h, sleep_q, rhr, weight_kg, legs, stress,
                           motivation, work_load, illness, notes, score, band)
    values (${day}, ${entry.sleep_h}, ${entry.sleep_q}, ${entry.rhr}, ${entry.weight_kg},
            ${entry.legs}, ${entry.stress}, ${entry.motivation}, ${entry.work_load},
            ${entry.illness}, ${entry.notes}, ${v.score}, ${v.band})
    on conflict (day) do update set
      sleep_h = excluded.sleep_h, sleep_q = excluded.sleep_q, rhr = excluded.rhr,
      weight_kg = excluded.weight_kg, legs = excluded.legs, stress = excluded.stress,
      motivation = excluded.motivation, work_load = excluded.work_load,
      illness = excluded.illness, notes = excluded.notes,
      score = excluded.score, band = excluded.band`;

  // Keep the working bodyweight current — the fuel targets run off it.
  if (entry.weight_kg) {
    const recent = await sql<{ w: string | null }[]>`
      select avg(weight_kg)::numeric(6,2) as w from readiness
      where weight_kg is not null and day > ${day}::date - interval '14 days'`;
    const w = Number(recent[0]?.w);
    if (Number.isFinite(w)) {
      await sql`update settings set weight_kg = ${w}, updated_at = now() where id = 1`;
    }
  }

  revalidatePath('/');
  revalidatePath('/progress');
  redirect('/');
}

/* --------------------------------------------------------------- knee */

export async function saveKneeAction(fd: FormData) {
  await requireUser();
  const day = str(fd, 'day') ?? today();
  await sql`
    insert into knee_log (day, swelling, pain, flexion_ok, knee10, plyo_done, notes)
    values (${day}, ${int(fd, 'swelling')}, ${int(fd, 'pain')}, ${bool(fd, 'flexion_ok')},
            ${bool(fd, 'knee10')}, ${bool(fd, 'plyo_done')}, ${str(fd, 'notes')})
    on conflict (day) do update set
      swelling = excluded.swelling, pain = excluded.pain, flexion_ok = excluded.flexion_ok,
      knee10 = excluded.knee10, plyo_done = excluded.plyo_done, notes = excluded.notes`;
  revalidatePath('/');
  revalidatePath('/knee');
  redirect('/knee?saved=1');
}

export async function saveLsiAction(fd: FormData) {
  await requireUser();
  const day = str(fd, 'day') ?? today();
  const tests = ['cmj', 'hop', 'crossover', 'wallsit'];
  let wrote = 0;
  for (const t of tests) {
    const l = num(fd, `${t}_left`);
    const r = num(fd, `${t}_right`);
    if (l === null || r === null || r === 0) continue;
    const lsi = Math.round((l / r) * 1000) / 10;
    await sql`
      insert into lsi_tests (day, test, left_val, right_val, lsi, note)
      values (${day}, ${t}, ${l}, ${r}, ${lsi}, ${str(fd, 'note')})
      on conflict (day, test) do update set
        left_val = excluded.left_val, right_val = excluded.right_val,
        lsi = excluded.lsi, note = excluded.note`;
    wrote++;
  }
  revalidatePath('/knee');
  revalidatePath('/progress');
  redirect(wrote ? '/knee?saved=1' : '/knee?empty=1');
}

/* ----------------------------------------------------------- sessions */

export async function saveSessionAction(fd: FormData) {
  await requireUser();
  await sql`
    insert into sessions (day, kind, gym_day, title, duration_min, rpe, detail, notes, completed)
    values (${str(fd, 'day') ?? today()}, ${str(fd, 'kind') ?? 'gym'}, ${str(fd, 'gym_day')},
            ${str(fd, 'title')}, ${int(fd, 'duration_min')}, ${int(fd, 'rpe')},
            ${str(fd, 'detail')}, ${str(fd, 'notes')}, ${!bool(fd, 'abandoned')})`;
  revalidatePath('/');
  revalidatePath('/log');
  revalidatePath('/progress');
  redirect('/log?saved=1');
}

export async function deleteSessionAction(fd: FormData) {
  await requireUser();
  const id = int(fd, 'id');
  if (id) await sql`delete from sessions where id = ${id}`;
  revalidatePath('/log');
}

export async function saveLiftAction(fd: FormData) {
  await requireUser();
  const ex = str(fd, 'exercise');
  if (!ex) redirect('/log');
  await sql`
    insert into lifts (day, exercise, load_kg, reps, sets, side, note)
    values (${str(fd, 'day') ?? today()}, ${ex}, ${num(fd, 'load_kg')}, ${int(fd, 'reps')},
            ${int(fd, 'sets')}, ${str(fd, 'side')}, ${str(fd, 'note')})`;
  revalidatePath('/log');
  revalidatePath('/progress');
  redirect('/log?saved=1');
}

/* -------------------------------------------------------- week ticks */

export async function toggleTickAction(fd: FormData) {
  await requireUser();
  const week = int(fd, 'week') ?? weekFor(today());
  const task = str(fd, 'task');
  if (!task) return;
  const done = bool(fd, 'done');
  await sql`
    insert into week_ticks (week, task, done) values (${week}, ${task}, ${done})
    on conflict (week, task) do update set done = excluded.done`;
  revalidatePath('/week');
  revalidatePath('/');
}

export async function resetWeekAction(fd: FormData) {
  await requireUser();
  const week = int(fd, 'week') ?? weekFor(today());
  await sql`delete from week_ticks where week = ${week}`;
  revalidatePath('/week');
}

/* -------------------------------------------------------------- work */

export async function saveJobAction(fd: FormData) {
  await requireUser();
  const id = int(fd, 'id');
  const title = str(fd, 'title');
  if (!title) redirect('/work');

  const fields = {
    client: str(fd, 'client'),
    title,
    kind: str(fd, 'kind') ?? 'build',
    due: str(fd, 'due'),
    est_min: int(fd, 'est_min') ?? 60,
    value_gbp: num(fd, 'value_gbp'),
    waiting_on: str(fd, 'waiting_on'),
    unblocks: str(fd, 'unblocks'),
    dread: bool(fd, 'dread'),
    status: str(fd, 'status') ?? 'todo',
    notes: str(fd, 'notes'),
  };

  if (id) {
    await sql`
      update jobs set
        client = ${fields.client}, title = ${fields.title}, kind = ${fields.kind},
        due = ${fields.due}, est_min = ${fields.est_min}, value_gbp = ${fields.value_gbp},
        waiting_on = ${fields.waiting_on}, unblocks = ${fields.unblocks},
        dread = ${fields.dread}, status = ${fields.status}, notes = ${fields.notes}
      where id = ${id}`;
  } else {
    await sql`
      insert into jobs (client, title, kind, due, est_min, value_gbp, waiting_on,
                        unblocks, dread, status, notes, created_at)
      values (${fields.client}, ${fields.title}, ${fields.kind}, ${fields.due},
              ${fields.est_min}, ${fields.value_gbp}, ${fields.waiting_on},
              ${fields.unblocks}, ${fields.dread}, ${fields.status}, ${fields.notes},
              ${today()})`;
  }

  revalidatePath('/work');
  revalidatePath('/');
  redirect('/work?saved=1');
}

export async function setJobStatusAction(fd: FormData) {
  await requireUser();
  const id = int(fd, 'id');
  const status = str(fd, 'status');
  if (!id || !status) return;
  if (status === 'done') {
    await sql`update jobs set status = 'done', done_at = ${today()}, last_touched = ${today()} where id = ${id}`;
  } else {
    await sql`update jobs set status = ${status}, last_touched = ${today()} where id = ${id}`;
  }
  revalidatePath('/work');
  revalidatePath('/');
}

export async function deleteJobAction(fd: FormData) {
  await requireUser();
  const id = int(fd, 'id');
  if (id) await sql`delete from jobs where id = ${id}`;
  revalidatePath('/work');
  revalidatePath('/');
}

/** Log time against a job — this is what keeps the prioritiser honest. */
export async function logWorkAction(fd: FormData) {
  await requireUser();
  const jobId = int(fd, 'job_id');
  const minutes = int(fd, 'minutes') ?? 0;
  const day = str(fd, 'day') ?? today();
  if (!minutes) redirect('/work');

  await sql`insert into work_log (day, job_id, minutes, note)
            values (${day}, ${jobId}, ${minutes}, ${str(fd, 'note')})`;

  if (jobId) {
    await sql`update jobs
              set logged_min = logged_min + ${minutes},
                  last_touched = ${day},
                  status = case when status = 'todo' then 'doing' else status end
              where id = ${jobId}`;
    if (bool(fd, 'finished')) {
      await sql`update jobs set status = 'done', done_at = ${day} where id = ${jobId}`;
    }
  }

  revalidatePath('/work');
  revalidatePath('/');
  redirect('/work?saved=1');
}

/* ------------------------------------------------------- work slots */

export async function saveSlotsAction(fd: FormData) {
  await requireUser();
  const slots = await getSlots();
  // The form posts one minutes field per existing slot, keyed by weekday+time.
  for (const s of slots) {
    const key = `slot_${s.weekday}_${s.time.replace(':', '')}`;
    const mins = int(fd, key);
    if (mins === null) continue;
    await sql`update work_slots set minutes = ${Math.max(0, mins)}
              where weekday = ${s.weekday} and time = ${s.time}`;
  }
  await sql`delete from work_slots where minutes = 0`;
  revalidatePath('/work');
  revalidatePath('/settings');
  redirect('/settings?saved=1');
}

export async function addSlotAction(fd: FormData) {
  await requireUser();
  const weekday = int(fd, 'weekday');
  const time = str(fd, 'time');
  const minutes = int(fd, 'minutes');
  if (!weekday || !time || !minutes) redirect('/settings');
  await sql`insert into work_slots (weekday, time, minutes, label, protected)
            values (${weekday}, ${time}, ${minutes}, ${str(fd, 'label') ?? 'Extra slot'}, false)`;
  revalidatePath('/work');
  revalidatePath('/settings');
  redirect('/settings?saved=1');
}

/* ---------------------------------------------------------- settings */

export async function saveSettingsAction(fd: FormData) {
  await requireUser();
  await sql`
    update settings set
      name        = coalesce(${str(fd, 'name')}, name),
      champs_date = coalesce(${str(fd, 'champs_date')}, champs_date),
      weight_kg   = coalesce(${num(fd, 'weight_kg')}, weight_kg),
      handicap    = ${num(fd, 'handicap')},
      rpm_hours   = coalesce(${int(fd, 'rpm_hours')}, rpm_hours),
      updated_at  = now()
    where id = 1`;
  revalidatePath('/');
  revalidatePath('/settings');
  redirect('/settings?saved=1');
}

/* ------------------------------------------------------- weekly note */

export async function saveWeeklyNoteAction(fd: FormData) {
  await requireUser();
  const week = int(fd, 'week') ?? weekFor(today());
  await sql`
    insert into weekly_notes (week, day, went_well, went_badly, one_change)
    values (${week}, ${today()}, ${str(fd, 'went_well')}, ${str(fd, 'went_badly')}, ${str(fd, 'one_change')})
    on conflict (week) do update set
      went_well = excluded.went_well, went_badly = excluded.went_badly,
      one_change = excluded.one_change, day = excluded.day`;
  revalidatePath('/week');
  redirect('/week?saved=1');
}

/* ===================================================================
 *  The performance OS.
 * =================================================================== */

/**
 * The morning check-in.
 *
 * It writes the new ten-point fields AND keeps the old five-point columns in
 * step, by halving. The readiness engine scores today against a rolling
 * fortnight, so if the changeover left the old columns empty the baseline would
 * break for two weeks and every verdict in that window would be wrong.
 */
export async function saveCheckInAction(fd: FormData) {
  await requireUser();
  const day = str(fd, 'day') ?? today();

  const stress10 = int(fd, 'stress10');
  const motivation10 = int(fd, 'motivation10');
  const soreness = int(fd, 'soreness');
  const rested = int(fd, 'rested');

  // 1–10 → 1–5, so the historical baseline stays comparable.
  const half = (v: number | null): number | null =>
    v === null ? null : Math.max(1, Math.min(5, Math.round(v / 2)));
  // Soreness runs the other way from "legs": 10 sore is 1 fresh.
  const legsFrom = soreness === null ? null : Math.max(1, Math.min(5, Math.round((11 - soreness) / 2)));

  await sql`
    insert into readiness (
      day, bed_at, asleep_at, woke_at, up_at, sleep_h, sleep_q,
      rested, energy, soreness, legs, stress, motivation,
      rhr, weight_kg, illness, alcohol, late_caffeine,
      pain_note, unusual, trained_yday, planned_today, checked_in_at
    ) values (
      ${day}, ${str(fd, 'bed_at')}, ${str(fd, 'asleep_at')}, ${str(fd, 'woke_at')}, ${str(fd, 'up_at')},
      ${num(fd, 'sleep_h')}, ${half(rested)},
      ${rested}, ${int(fd, 'energy')}, ${soreness}, ${legsFrom},
      ${half(stress10)}, ${half(motivation10)},
      ${int(fd, 'rhr')}, ${num(fd, 'weight_kg')}, ${bool(fd, 'illness')},
      ${bool(fd, 'alcohol')}, ${bool(fd, 'late_caffeine')},
      ${str(fd, 'pain_note')}, ${str(fd, 'unusual')},
      ${str(fd, 'trained_yday')}, ${str(fd, 'planned_today')}, now()
    )
    on conflict (day) do update set
      bed_at = excluded.bed_at, asleep_at = excluded.asleep_at,
      woke_at = excluded.woke_at, up_at = excluded.up_at,
      sleep_h = excluded.sleep_h, sleep_q = excluded.sleep_q,
      rested = excluded.rested, energy = excluded.energy,
      soreness = excluded.soreness, legs = excluded.legs,
      stress = excluded.stress, motivation = excluded.motivation,
      rhr = excluded.rhr, weight_kg = excluded.weight_kg, illness = excluded.illness,
      alcohol = excluded.alcohol, late_caffeine = excluded.late_caffeine,
      pain_note = excluded.pain_note, unusual = excluded.unusual,
      trained_yday = excluded.trained_yday, planned_today = excluded.planned_today,
      checked_in_at = coalesce(readiness.checked_in_at, now())`;

  // Score it with the engine rather than the form, so the stored band and the
  // displayed one can never disagree.
  const history = await recentReadiness(day, 30);
  const row = history.find((r) => r.day === day);
  if (row) {
    const v = assess(row as Readiness, history.filter((r) => r.day !== day));
    await sql`update readiness set score = ${v.score}, band = ${v.band} where day = ${day}`;
  }

  // Waking late changes the whole day, so the plan is rebuilt rather than left
  // describing a morning that did not happen.
  await sql`delete from plan_blocks where day = ${day} and locked = false and status = 'planned'`;

  revalidatePath('/');
  revalidatePath('/checkin');
  redirect('/');
}

/* ------------------------------------------------------------ the plan */

export async function setBlockStatusAction(fd: FormData) {
  await requireUser();
  const id = int(fd, 'id');
  const status = str(fd, 'status') ?? 'planned';
  if (id) await sql`update plan_blocks set status = ${status} where id = ${id}`;
  revalidatePath('/');
}

export async function lockBlockAction(fd: FormData) {
  await requireUser();
  const id = int(fd, 'id');
  const locked = str(fd, 'locked') === '1';
  if (id) await sql`update plan_blocks set locked = ${locked} where id = ${id}`;
  revalidatePath('/');
}

/**
 * Throw away the generated part of the day and let it be rebuilt.
 *
 * Locked blocks, and anything already marked done or skipped, are left exactly
 * where they are. Replanning that quietly moved something you had locked would
 * be worse than not replanning at all.
 */
export async function replanAction(fd: FormData) {
  await requireUser();
  const day = str(fd, 'day') ?? today();
  await sql`
    delete from plan_blocks
    where day = ${day} and locked = false and status = 'planned' and generated = true`;
  revalidatePath('/');
}

export async function moveBlockAction(fd: FormData) {
  await requireUser();
  const id = int(fd, 'id');
  const start = str(fd, 'start_at');
  const end = str(fd, 'end_at');
  if (id && start && end) {
    await sql`
      update plan_blocks set start_at = ${start}, end_at = ${end}, locked = true, generated = false
      where id = ${id}`;
  }
  revalidatePath('/');
}

export async function addBlockAction(fd: FormData) {
  await requireUser();
  const day = str(fd, 'day') ?? today();
  const title = str(fd, 'title');
  const start = str(fd, 'start_at');
  const end = str(fd, 'end_at');
  if (!title || !start || !end) redirect(`/?day=${day}`);
  await sql`
    insert into plan_blocks (day, start_at, end_at, kind, title, detail, locked, generated)
    values (${day}, ${start}, ${end}, ${str(fd, 'kind') ?? 'event'}, ${title},
            ${str(fd, 'detail')}, true, false)
    on conflict (day, start_at, title) do nothing`;
  revalidatePath('/');
  redirect(`/?day=${day}`);
}

/* -------------------------------------------------------- the calendar */

export async function saveEventAction(fd: FormData) {
  await requireUser();
  const id = int(fd, 'id');
  const day = str(fd, 'day');
  const title = str(fd, 'title');
  if (!day || !title) redirect('/calendar');

  const vals = {
    day,
    end_day: str(fd, 'end_day'),
    start_at: str(fd, 'start_at'),
    end_at: str(fd, 'end_at'),
    title,
    kind: str(fd, 'kind') ?? 'event',
    venue: str(fd, 'venue'),
    notes: str(fd, 'notes'),
    fixed: fd.get('fixed') === null ? true : bool(fd, 'fixed'),
    travel_min: int(fd, 'travel_min') ?? 0,
  };

  if (id) {
    await sql`
      update calendar_events set
        day = ${vals.day}, end_day = ${vals.end_day}, start_at = ${vals.start_at},
        end_at = ${vals.end_at}, title = ${vals.title}, kind = ${vals.kind},
        venue = ${vals.venue}, notes = ${vals.notes}, fixed = ${vals.fixed},
        travel_min = ${vals.travel_min}
      where id = ${id}`;
  } else {
    await sql`
      insert into calendar_events (day, end_day, start_at, end_at, title, kind, venue, notes, fixed, travel_min)
      values (${vals.day}, ${vals.end_day}, ${vals.start_at}, ${vals.end_at}, ${vals.title},
              ${vals.kind}, ${vals.venue}, ${vals.notes}, ${vals.fixed}, ${vals.travel_min})`;
  }

  // A new commitment changes the day it lands on, so its plan is rebuilt.
  await sql`delete from plan_blocks where day = ${day} and locked = false and status = 'planned'`;
  revalidatePath('/calendar');
  revalidatePath('/');
  redirect(`/calendar?d=${day}`);
}

export async function deleteEventAction(fd: FormData) {
  await requireUser();
  const id = int(fd, 'id');
  if (id) await sql`delete from calendar_events where id = ${id}`;
  revalidatePath('/calendar');
  revalidatePath('/');
}

/* ------------------------------------------------------------- goals */

export async function saveGoalAction(fd: FormData) {
  await requireUser();
  const id = int(fd, 'id');
  const title = str(fd, 'title');
  if (!title) redirect('/goals');

  const v = {
    title,
    area: str(fd, 'area') ?? 'life',
    metric: str(fd, 'metric'),
    unit: str(fd, 'unit'),
    start_value: num(fd, 'start_value'),
    current_value: num(fd, 'current_value'),
    target_value: num(fd, 'target_value'),
    lower_better: bool(fd, 'lower_better'),
    target_date: str(fd, 'target_date'),
    status: str(fd, 'status') ?? 'active',
    notes: str(fd, 'notes'),
  };

  if (id) {
    await sql`
      update goals set
        title = ${v.title}, area = ${v.area}, metric = ${v.metric}, unit = ${v.unit},
        start_value = ${v.start_value}, current_value = ${v.current_value},
        target_value = ${v.target_value}, lower_better = ${v.lower_better},
        target_date = ${v.target_date}, status = ${v.status}, notes = ${v.notes}
      where id = ${id}`;
    // A changed current value is a data point, not just an edit.
    if (v.current_value !== null) {
      await sql`
        insert into goal_progress (goal_id, day, value)
        values (${id}, ${today()}, ${v.current_value})
        on conflict (goal_id, day) do update set value = excluded.value`;
    }
  } else {
    await sql`
      insert into goals (title, area, metric, unit, start_value, current_value, target_value,
                         lower_better, target_date, status, notes, sort)
      values (${v.title}, ${v.area}, ${v.metric}, ${v.unit}, ${v.start_value}, ${v.current_value},
              ${v.target_value}, ${v.lower_better}, ${v.target_date}, ${v.status}, ${v.notes},
              coalesce((select max(sort) + 1 from goals), 1))`;
  }
  revalidatePath('/goals');
  revalidatePath('/');
  redirect('/goals');
}

export async function setGoalStatusAction(fd: FormData) {
  await requireUser();
  const id = int(fd, 'id');
  const status = str(fd, 'status') ?? 'active';
  if (id) await sql`update goals set status = ${status} where id = ${id}`;
  revalidatePath('/goals');
}

/* --------------------------------------------------------- ski racing */

export async function saveRaceAction(fd: FormData) {
  await requireUser();
  const id = int(fd, 'id');
  const day = str(fd, 'day');
  const name = str(fd, 'name');
  if (!day || !name) redirect('/track/ski');

  const v = {
    day, name,
    venue: str(fd, 'venue'),
    surface: str(fd, 'surface') ?? 'dry',
    format: str(fd, 'format') ?? 'club',
    discipline: str(fd, 'discipline') ?? 'slalom',
    position: int(fd, 'position'),
    field_size: int(fd, 'field_size'),
    winner_sec: num(fd, 'winner_sec'),
    obarts: num(fd, 'obarts'),
    notes: str(fd, 'notes'),
  };

  const raceId = id ?? (await sql<{ id: number }[]>`
    insert into ski_races (day, name, venue, surface, format, discipline, position, field_size, winner_sec, obarts, notes)
    values (${v.day}, ${v.name}, ${v.venue}, ${v.surface}, ${v.format}, ${v.discipline},
            ${v.position}, ${v.field_size}, ${v.winner_sec}, ${v.obarts}, ${v.notes})
    returning id`)[0].id;

  if (id) {
    await sql`
      update ski_races set
        day = ${v.day}, name = ${v.name}, venue = ${v.venue}, surface = ${v.surface},
        format = ${v.format}, discipline = ${v.discipline}, position = ${v.position},
        field_size = ${v.field_size}, winner_sec = ${v.winner_sec}, obarts = ${v.obarts},
        notes = ${v.notes}
      where id = ${id}`;
  }

  // Runs. A club national has three, a championship two.
  const runCount = v.format === 'club' ? 3 : 2;
  for (let n = 1; n <= runCount; n++) {
    const t = num(fd, `run${n}`);
    const st = str(fd, `run${n}_status`) ?? 'ok';
    if (t === null && st === 'ok') {
      await sql`delete from ski_runs where race_id = ${raceId} and run_no = ${n}`;
      continue;
    }
    await sql`
      insert into ski_runs (race_id, run_no, time_sec, status, penalty)
      values (${raceId}, ${n}, ${t}, ${st}, ${num(fd, `run${n}_pen`)})
      on conflict (race_id, run_no) do update set
        time_sec = excluded.time_sec, status = excluded.status, penalty = excluded.penalty`;
  }

  // The total is recomputed from the runs, never typed in — the two formats
  // add up differently and a hand-typed total is how that gets silently wrong.
  const runs = await sql<{ run_no: number; time_sec: string | null; status: string; penalty: string | null }[]>`
    select run_no, time_sec, status, penalty from ski_runs where race_id = ${raceId} order by run_no`;
  const { raceTotal } = await import('@/lib/ski');
  const res = raceTotal(v.format as 'club' | 'champs', runs.map((r) => ({
    run_no: r.run_no,
    time_sec: r.time_sec === null ? null : Number(r.time_sec),
    status: r.status as 'ok' | 'dnf' | 'dsq' | 'dns',
    penalty: r.penalty === null ? null : Number(r.penalty),
    note: null,
  })));
  await sql`update ski_races set total_sec = ${res.total} where id = ${raceId}`;

  // O-Barts points and race position both feed live goals.
  if (v.obarts !== null) await bumpGoal('obarts-10', v.obarts);
  if (v.position !== null) await bumpGoal('british-champion', v.position);

  revalidatePath('/track/ski');
  revalidatePath('/goals');
  redirect('/track/ski');
}

export async function deleteRaceAction(fd: FormData) {
  await requireUser();
  const id = int(fd, 'id');
  if (id) await sql`delete from ski_races where id = ${id}`;
  revalidatePath('/track/ski');
}

export async function saveSkiSessionAction(fd: FormData) {
  await requireUser();
  const day = str(fd, 'day') ?? today();
  await sql`
    insert into ski_sessions (day, venue, surface, kind, duration_min, runs, focus, intensity, confidence, notes)
    values (${day}, ${str(fd, 'venue')}, ${str(fd, 'surface') ?? 'dry'}, ${str(fd, 'kind') ?? 'gates'},
            ${int(fd, 'duration_min')}, ${int(fd, 'runs')}, ${str(fd, 'focus')},
            ${int(fd, 'intensity')}, ${int(fd, 'confidence')}, ${str(fd, 'notes')})`;
  revalidatePath('/track/ski');
  redirect('/track/ski');
}

/* ------------------------------------------------ golf, brand, money */

export async function saveGolfAction(fd: FormData) {
  await requireUser();
  const day = str(fd, 'day') ?? today();
  const hcp = num(fd, 'handicap');
  await sql`
    insert into golf_rounds (day, course, holes, score, par, handicap, notes)
    values (${day}, ${str(fd, 'course')}, ${int(fd, 'holes') ?? 18}, ${int(fd, 'score')},
            ${int(fd, 'par')}, ${hcp}, ${str(fd, 'notes')})`;
  if (hcp !== null) {
    await sql`update settings set golf_handicap = ${hcp} where id = 1`;
    await bumpGoal('golf-10', hcp);
  }
  revalidatePath('/track/golf');
  revalidatePath('/goals');
  redirect('/track/golf');
}

export async function saveBrandAction(fd: FormData) {
  await requireUser();
  const day = str(fd, 'day') ?? today();
  const followers = int(fd, 'followers');
  await sql`
    insert into brand_metrics (day, followers, posts, reels, views, engagement, minutes, leads, revenue_gbp, notes)
    values (${day}, ${followers}, ${int(fd, 'posts')}, ${int(fd, 'reels')}, ${int(fd, 'views')},
            ${int(fd, 'engagement')}, ${int(fd, 'minutes')}, ${int(fd, 'leads')},
            ${num(fd, 'revenue_gbp')}, ${str(fd, 'notes')})
    on conflict (day) do update set
      followers = excluded.followers, posts = excluded.posts, reels = excluded.reels,
      views = excluded.views, engagement = excluded.engagement, minutes = excluded.minutes,
      leads = excluded.leads, revenue_gbp = excluded.revenue_gbp, notes = excluded.notes`;
  if (followers !== null) await bumpGoal('brand-10k', followers);
  revalidatePath('/track/brand');
  revalidatePath('/goals');
  redirect('/track/brand');
}

export async function saveMoneyAction(fd: FormData) {
  await requireUser();
  const amount = num(fd, 'amount_gbp');
  if (amount === null) redirect('/track/money');
  await sql`
    insert into money_entries (day, kind, category, label, amount_gbp, notes)
    values (${str(fd, 'day') ?? today()}, ${str(fd, 'kind') ?? 'expense'},
            ${str(fd, 'category')}, ${str(fd, 'label')}, ${amount}, ${str(fd, 'notes')})`;
  revalidatePath('/track/money');
  redirect('/track/money');
}

export async function deleteMoneyAction(fd: FormData) {
  await requireUser();
  const id = int(fd, 'id');
  if (id) await sql`delete from money_entries where id = ${id}`;
  revalidatePath('/track/money');
}

/* ----------------------------------------------------- the day frame */

export async function saveFrameAction(fd: FormData) {
  await requireUser();
  await sql`
    update settings set
      wake_time      = coalesce(${str(fd, 'wake_time')}, wake_time),
      bed_time       = coalesce(${str(fd, 'bed_time')}, bed_time),
      sleep_target_h = coalesce(${num(fd, 'sleep_target_h')}, sleep_target_h),
      rpm_daily_h    = coalesce(${num(fd, 'rpm_daily_h')}, rpm_daily_h),
      work_cap_h     = coalesce(${num(fd, 'work_cap_h')}, work_cap_h),
      free_floor_min = coalesce(${int(fd, 'free_floor_min')}, free_floor_min),
      updated_at     = now()
    where id = 1`;
  await sql`delete from plan_blocks where day >= ${today()} and locked = false and status = 'planned'`;
  revalidatePath('/');
  revalidatePath('/more');
  redirect('/more?saved=1');
}

export async function saveCommitmentAction(fd: FormData) {
  await requireUser();
  const id = int(fd, 'id');
  const title = str(fd, 'title');
  const weekday = int(fd, 'weekday');
  const start = str(fd, 'start_at');
  const minutes = int(fd, 'minutes');
  if (!title || !weekday || !start || !minutes) redirect('/more');
  if (id) {
    await sql`
      update commitments set weekday = ${weekday}, start_at = ${start}, minutes = ${minutes},
        title = ${title}, kind = ${str(fd, 'kind') ?? 'event'},
        travel_min = ${int(fd, 'travel_min') ?? 0}, notes = ${str(fd, 'notes')},
        active = ${fd.get('active') === null ? true : bool(fd, 'active')}
      where id = ${id}`;
  } else {
    await sql`
      insert into commitments (weekday, start_at, minutes, title, kind, travel_min, notes)
      values (${weekday}, ${start}, ${minutes}, ${title}, ${str(fd, 'kind') ?? 'event'},
              ${int(fd, 'travel_min') ?? 0}, ${str(fd, 'notes')})`;
  }
  await sql`delete from plan_blocks where day >= ${today()} and locked = false and status = 'planned'`;
  revalidatePath('/more');
  revalidatePath('/');
  redirect('/more?saved=1');
}

export async function deleteCommitmentAction(fd: FormData) {
  await requireUser();
  const id = int(fd, 'id');
  if (id) await sql`delete from commitments where id = ${id}`;
  revalidatePath('/more');
  revalidatePath('/');
}

/** Push a value onto a seeded goal without needing to know its id. */
async function bumpGoal(slug: string, value: number): Promise<void> {
  const rows = await sql<{ id: number; start_value: string | null }[]>`
    select id, start_value from goals where slug = ${slug}`;
  const g = rows[0];
  if (!g) return;
  await sql`
    update goals set
      current_value = ${value},
      start_value = coalesce(start_value, ${value})
    where id = ${g.id}`;
  await sql`
    insert into goal_progress (goal_id, day, value)
    values (${g.id}, ${today()}, ${value})
    on conflict (goal_id, day) do update set value = excluded.value`;
}

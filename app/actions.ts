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

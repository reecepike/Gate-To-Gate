-- Gate to Gate — schema. Safe to run more than once.

create table if not exists users (
  id            serial primary key,
  email         text not null unique,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create table if not exists settings (
  id            int primary key default 1,
  name          text not null default 'Reece',
  champs_date   date not null default '2027-07-24',
  surgery_date  date not null default '2025-09-04',
  start_date    date not null default '2026-08-31',
  weight_kg     numeric(5,2) not null default 70.0,
  handicap      numeric(4,1),
  rpm_hours     int not null default 40,
  updated_at    timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);

insert into settings (id) values (1) on conflict (id) do nothing;

-- ------------------------------------------------------------ readiness
create table if not exists readiness (
  day         date primary key,
  sleep_h     numeric(4,2),
  sleep_q     int,
  rhr         int,
  weight_kg   numeric(5,2),
  legs        int,
  stress      int,
  motivation  int,
  work_load   int,
  illness     boolean not null default false,
  notes       text,
  score       int,
  band        text,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------- knee log
create table if not exists knee_log (
  day         date primary key,
  swelling    int,                       -- 0 zero, 1 trace, 2 = 1+, 3 = 2+
  pain        int,                       -- 0–10
  flexion_ok  boolean not null default true,
  knee10      boolean not null default false,
  plyo_done   boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now()
);

-- Monthly limb symmetry battery. One row per test per date.
create table if not exists lsi_tests (
  id        serial primary key,
  day       date not null,
  test      text not null,               -- cmj | hop | crossover | wallsit
  left_val  numeric(8,2) not null,
  right_val numeric(8,2) not null,
  lsi       numeric(5,1) not null,
  note      text,
  unique (day, test)
);

-- ------------------------------------------------------------- sessions
create table if not exists sessions (
  id           serial primary key,
  day          date not null,
  kind         text not null,            -- gym | gates | golf | swim | run | bike | mtb | race | spa
  gym_day      text,                     -- lowerA | push | cond | lowerB | pull
  title        text,
  duration_min int,
  rpe          int,
  detail       text,
  notes        text,
  completed    boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists sessions_day_idx on sessions (day);

-- Top sets worth remembering — the numbers that tell you the ten kilos is useful.
create table if not exists lifts (
  id         serial primary key,
  day        date not null,
  exercise   text not null,
  load_kg    numeric(6,2),
  reps       int,
  sets       int,
  side       text,                       -- left | right | both
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists lifts_day_idx on lifts (day);

-- ------------------------------------------------------------ week ticks
create table if not exists week_ticks (
  week int not null,
  task text not null,
  done boolean not null default false,
  primary key (week, task)
);

-- ------------------------------------------------------------------ work
create table if not exists jobs (
  id           serial primary key,
  client       text,
  title        text not null,
  kind         text not null default 'build',
  due          date,
  est_min      int not null default 60,
  logged_min   int not null default 0,
  value_gbp    numeric(10,2),
  waiting_on   text,
  unblocks     text,
  dread        boolean not null default false,
  status       text not null default 'todo',     -- todo | doing | parked | done
  last_touched date,
  notes        text,
  created_at   date not null default current_date,
  done_at      date
);

create index if not exists jobs_status_idx on jobs (status);

create table if not exists work_log (
  id         serial primary key,
  day        date not null,
  job_id     int references jobs (id) on delete set null,
  minutes    int not null,
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists work_log_day_idx on work_log (day);

-- Your real, honest capacity. Seeded from the week timetable.
create table if not exists work_slots (
  id        serial primary key,
  weekday   int not null,                -- 1 Mon … 7 Sun
  time      text not null,
  minutes   int not null,
  label     text not null,
  protected boolean not null default false
);

insert into work_slots (weekday, time, minutes, label, protected)
select * from (values
  (7, '18:30', 90,  'Sunday — ring-fenced', true),
  (1, '21:00', 90,  'Monday evening', false),
  (5, '20:00', 120, 'Friday evening', false),
  (6, '20:00', 90,  'Saturday evening', false),
  (2, '21:00', 60,  'Tuesday evening (borrowed against Wednesday)', false)
) as v (weekday, time, minutes, label, protected)
where not exists (select 1 from work_slots);

-- ----------------------------------------------------------- reflection
create table if not exists weekly_notes (
  week       int primary key,
  day        date not null default current_date,
  went_well  text,
  went_badly text,
  one_change text,
  created_at timestamptz not null default now()
);

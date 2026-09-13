-- ===================================================================
--  Gate to Gate — migration for the performance-OS rebuild
--
--  Run this ONCE against your Neon database, after deploying the new
--  code. Everything in it is additive: it adds columns and tables and
--  seeds the goals and the races you already had hardcoded. It changes
--  no data you already have, and running it twice does nothing the
--  second time.
--
--  In the Neon console: SQL Editor -> paste the whole file -> Run.
-- ===================================================================

-- ===================================================================
--  The performance-OS rebuild.
--
--  Everything below is additive and idempotent. No existing table is
--  dropped, no existing column changes type, and every new column has
--  a default so old rows stay valid. Run it as many times as you like.
-- ===================================================================

-- ---------------------------------------------------------- settings
-- The day frame the planner works inside, and how much of it is yours.
alter table settings add column if not exists wake_time      text not null default '07:30';
alter table settings add column if not exists bed_time       text not null default '23:15';
alter table settings add column if not exists sleep_target_h numeric(4,2) not null default 8.25;
-- Hours of RPM a normal working day owes. A budget the planner places,
-- not a block it works around — you set your own start and finish.
alter table settings add column if not exists rpm_daily_h    numeric(4,2) not null default 7.0;
alter table settings add column if not exists work_cap_h     numeric(4,2) not null default 9.0;
-- Free time is a feature, not what is left over. This is the floor.
alter table settings add column if not exists free_floor_min int not null default 120;
alter table settings add column if not exists obarts_points  numeric(6,2);
alter table settings add column if not exists golf_handicap  numeric(4,1);

-- ---------------------------------------------------- the check-in
-- The morning sleep/recovery check-in from §6. Added to the existing
-- readiness row rather than a new table, so every historical row keeps
-- working and the readiness engine keeps its baseline.
alter table readiness add column if not exists bed_at        text;
alter table readiness add column if not exists asleep_at     text;
alter table readiness add column if not exists woke_at       text;
alter table readiness add column if not exists up_at         text;
alter table readiness add column if not exists rested        int;   -- 1–10
alter table readiness add column if not exists energy        int;   -- 1–10
alter table readiness add column if not exists soreness      int;   -- 1–10
alter table readiness add column if not exists pain_note     text;
alter table readiness add column if not exists unusual       text;
alter table readiness add column if not exists trained_yday  text;
alter table readiness add column if not exists alcohol       boolean not null default false;
alter table readiness add column if not exists late_caffeine boolean not null default false;
alter table readiness add column if not exists planned_today text;
-- Marks the row as a completed morning check-in rather than a partial
-- edit, which is what the once-a-day gate keys off.
alter table readiness add column if not exists checked_in_at timestamptz;

-- ------------------------------------------------------- calendar
-- The internal calendar is the source of truth (§11). Races that were
-- hardcoded in lib/plan.ts are seeded in below so nothing is lost.
create table if not exists calendar_events (
  id          serial primary key,
  day         date not null,
  end_day     date,
  start_at    text,                    -- 'HH:MM', null = all day
  end_at      text,
  title       text not null,
  kind        text not null default 'event',
  -- event | race | ski | gym | golf | work | meeting | deadline
  -- travel | social | appointment | holiday | admin
  venue       text,
  notes       text,
  -- Protected blocks the planner may never move.
  fixed       boolean not null default true,
  travel_min  int not null default 0,
  source_key  text unique,             -- for idempotent seeding
  created_at  timestamptz not null default now()
);
create index if not exists calendar_day_idx on calendar_events (day);

-- Recurring fixed commitments — the genuinely immovable parts of a
-- normal week, seeded from the old hardcoded timetable.
create table if not exists commitments (
  id         serial primary key,
  weekday    int not null,             -- 1 Mon … 7 Sun
  start_at   text not null,
  minutes    int not null,
  title      text not null,
  kind       text not null default 'event',
  travel_min int not null default 0,
  active     boolean not null default true,
  notes      text
);

-- --------------------------------------------------- the timetable
-- What the planner produced for a day, and what you did to it. A block
-- you locked survives replanning; everything else is regenerated.
create table if not exists plan_blocks (
  id         serial primary key,
  day        date not null,
  start_at   text not null,
  end_at     text not null,
  kind       text not null,            -- work | train | ski | golf | meal
                                       -- free | social | admin | brand
                                       -- recovery | sleep | travel | event
  title      text not null,
  detail     text,
  why        text,
  job_id     int references jobs (id) on delete set null,
  event_id   int references calendar_events (id) on delete cascade,
  goal_id    int,
  locked     boolean not null default false,
  status     text not null default 'planned',  -- planned | done | skipped
  generated  boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists plan_blocks_day_idx on plan_blocks (day);
create unique index if not exists plan_blocks_slot_idx on plan_blocks (day, start_at, title);

-- ------------------------------------------------------------ goals
create table if not exists goals (
  id           serial primary key,
  slug         text unique,
  title        text not null,
  area         text not null,          -- ski | business | brand | golf
                                       -- fitness | money | life
  metric       text,                   -- what is being counted
  unit         text,
  start_value  numeric(12,2),
  current_value numeric(12,2),
  target_value numeric(12,2),
  -- Lower is better for handicaps and race points.
  lower_better boolean not null default false,
  target_date  date,
  status       text not null default 'active',   -- active | paused | done | archived
  sort         int not null default 0,
  notes        text,
  created_at   timestamptz not null default now()
);

create table if not exists goal_milestones (
  id       serial primary key,
  goal_id  int not null references goals (id) on delete cascade,
  label    text not null,
  value    numeric(12,2),
  sort     int not null default 0,
  hit_on   date
);

create table if not exists goal_progress (
  id      serial primary key,
  goal_id int not null references goals (id) on delete cascade,
  day     date not null,
  value   numeric(12,2) not null,
  note    text,
  unique (goal_id, day)
);

-- ------------------------------------------------------- ski racing
create table if not exists ski_races (
  id          serial primary key,
  day         date not null,
  name        text not null,
  venue       text,
  surface     text not null default 'dry',      -- dry | snow
  format      text not null default 'club',     -- club | champs
  discipline  text not null default 'slalom',
  position    int,
  field_size  int,
  winner_sec  numeric(8,2),
  total_sec   numeric(8,2),
  obarts      numeric(6,2),
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists ski_races_day_idx on ski_races (day);

create table if not exists ski_runs (
  id       serial primary key,
  race_id  int not null references ski_races (id) on delete cascade,
  run_no   int not null,
  time_sec numeric(8,2),
  status   text not null default 'ok',   -- ok | dnf | dsq | dns
  penalty  numeric(6,2),
  note     text,
  unique (race_id, run_no)
);

-- Ski training, separate from gym sessions because the fields differ.
create table if not exists ski_sessions (
  id           serial primary key,
  day          date not null,
  venue        text,
  surface      text not null default 'dry',
  kind         text not null default 'gates',  -- gates | free | starts
                                               -- technical | conditioning | mobility
  duration_min int,
  runs         int,
  focus        text,
  intensity    int,        -- 1–10
  confidence   int,        -- 1–10
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists ski_sessions_day_idx on ski_sessions (day);

-- ------------------------------------------------------------- golf
create table if not exists golf_rounds (
  id        serial primary key,
  day       date not null,
  course    text,
  holes     int not null default 18,
  score     int,
  par       int,
  handicap  numeric(4,1),
  notes     text
);
create index if not exists golf_day_idx on golf_rounds (day);

-- --------------------------------------------------- personal brand
create table if not exists brand_metrics (
  day         date primary key,
  followers   int,
  posts       int,
  reels       int,
  views       int,
  engagement  int,
  minutes     int,
  leads       int,
  revenue_gbp numeric(10,2),
  notes       text
);

-- ------------------------------------------------------------ money
create table if not exists money_entries (
  id         serial primary key,
  day        date not null,
  kind       text not null,     -- income | expense | saving | investment | reinvest
  category   text,
  label      text,
  amount_gbp numeric(12,2) not null,
  notes      text,
  created_at timestamptz not null default now()
);
create index if not exists money_day_idx on money_entries (day);

-- ------------------------------------------------------- day score
create table if not exists day_scores (
  day        date primary key,
  score      int,
  band       text,
  parts      jsonb not null default '{}'::jsonb,
  confidence text not null default 'partial',   -- full | partial | insufficient
  note       text,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------- work, expanded
alter table jobs add column if not exists project      text;
alter table jobs add column if not exists parent_id    int references jobs (id) on delete cascade;
alter table jobs add column if not exists recurring    text;     -- daily | weekly | fortnightly | monthly
alter table jobs add column if not exists recur_dow    int;
alter table jobs add column if not exists next_due     date;
alter table jobs add column if not exists area         text not null default 'work';
alter table jobs add column if not exists goal_id      int references goals (id) on delete set null;

-- ---------------------------------------------------------- seeding
-- The five races and two test days that used to live in lib/plan.ts.
-- source_key makes this safe to re-run and safe to edit afterwards:
-- change a date in the app and the seed will not put it back.
insert into calendar_events (day, end_day, title, kind, venue, notes, fixed, source_key)
select * from (values
  ('2026-09-04'::date, '2026-09-04'::date, 'One year post-op — baseline test day', 'event', 'Not a race', 'Full symmetry battery. The number everything else gets measured against.', true, 'seed-postop-1y'),
  ('2026-09-12', '2026-09-13', 'Welsh Championships', 'race', 'Dryslope', 'Baseline', true, 'seed-welsh-2026'),
  ('2026-09-20', '2026-09-20', 'Llandudno Club National', 'race', 'Llandudno', 'Apply one fix', true, 'seed-llandudno-2026'),
  ('2026-09-26', '2026-09-27', 'Irish Nationals', 'race', 'TBC', 'Optional', true, 'seed-irish-2026'),
  ('2026-11-15', '2026-11-15', 'Implode Club National', 'race', 'TBC', 'Mid-build check', true, 'seed-implode-2026'),
  ('2027-03-13', '2027-03-13', 'March checkpoint', 'event', 'Not a race', 'Full benchmark battery.', true, 'seed-march-checkpoint'),
  ('2027-07-24', '2027-07-25', 'British Championships', 'race', 'Date TBC', 'The target.', true, 'seed-champs-2027')
) as v (day, end_day, title, kind, venue, notes, fixed, source_key)
on conflict (source_key) do nothing;

-- The genuinely immovable parts of a normal week. RPM is deliberately
-- NOT here: the hours are a budget the planner places, because you set
-- your own start and finish.
insert into commitments (weekday, start_at, minutes, title, kind, travel_min, notes)
select * from (values
  (3, '18:00', 90, 'Gates — Aldershot', 'ski', 150, 'The session everything else exists to support. 2 h 30 each way, so the whole afternoon and evening are gone.')
) as v (weekday, start_at, minutes, title, kind, travel_min, notes)
where not exists (select 1 from commitments);

-- The goals from §24. Editable, pausable, archivable — the seed only
-- ever runs once, so anything you change here stays changed.
insert into goals (slug, title, area, metric, unit, start_value, current_value, target_value, lower_better, target_date, sort)
select * from (values
  ('british-champion', 'British Champion', 'ski', 'Best championship position', 'place', null::numeric, null::numeric, 1::numeric, true, '2027-07-24'::date, 1),
  ('obarts-10', '10 O-Barts points', 'ski', 'O-Barts points, dry slope', 'pts', null, null, 10, true, '2027-07-24', 2),
  ('rpm-20k', 'RPM — £20k/month from Meta Ads', 'business', 'Monthly managed revenue', '£/mo', null, null, 20000, false, null, 3),
  ('brand-10k', '10,000 followers', 'brand', 'Followers', 'followers', null, null, 10000, false, null, 4),
  ('golf-10', '10 handicap', 'golf', 'Playing handicap', 'hcp', null, null, 10, true, null, 5),
  ('legpress-150', '150 kg leg press', 'fitness', 'Top set', 'kg', null, null, 150, false, null, 6),
  ('new-car', 'New car', 'money', 'Saved towards it', '£', null, null, null, false, null, 7)
) as v (slug, title, area, metric, unit, start_value, current_value, target_value, lower_better, target_date, sort)
on conflict (slug) do nothing;

insert into goal_milestones (goal_id, label, value, sort)
select g.id, m.label, m.value, m.sort
from goals g
join (values
  ('british-champion', 'Top 10', 10::numeric, 1),
  ('british-champion', 'Top 5', 5, 2),
  ('british-champion', 'Podium', 3, 3),
  ('british-champion', 'Win a national', 1, 4),
  ('british-champion', 'British Champion', 1, 5),
  ('obarts-10', 'Under 40 pts', 40, 1),
  ('obarts-10', 'Under 25 pts', 25, 2),
  ('obarts-10', 'Under 15 pts', 15, 3),
  ('obarts-10', '10 pts', 10, 4),
  ('rpm-20k', '£5k/month', 5000, 1),
  ('rpm-20k', '£10k/month', 10000, 2),
  ('rpm-20k', '£15k/month', 15000, 3),
  ('rpm-20k', '£20k/month', 20000, 4),
  ('brand-10k', '1,000 followers', 1000, 1),
  ('brand-10k', '2,500 followers', 2500, 2),
  ('brand-10k', '5,000 followers', 5000, 3),
  ('brand-10k', '10,000 followers', 10000, 4),
  ('golf-10', '18 handicap', 18, 1),
  ('golf-10', '15 handicap', 15, 2),
  ('golf-10', '12 handicap', 12, 3),
  ('golf-10', '10 handicap', 10, 4),
  ('legpress-150', '110 kg', 110, 1),
  ('legpress-150', '125 kg', 125, 2),
  ('legpress-150', '140 kg', 140, 3),
  ('legpress-150', '150 kg', 150, 4)
) as m (slug, label, value, sort) on m.slug = g.slug
where not exists (select 1 from goal_milestones where goal_id = g.id);

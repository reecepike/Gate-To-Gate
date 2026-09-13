# Gate to Gate — the performance OS

Phase 1 (audit) and Phase 2/3 (foundation + planning engine) are done and working.
Read the audit first; it explains what I kept and why.

---

## The audit

**Stack:** Next.js 16.3.4 App Router, React 19, postgres.js, server actions, scrypt +
HMAC cookie auth, zero extra dependencies. 12 tables, 18 server actions, 10 routes.
Right for this job — nothing needed replacing.

**Four engines that already worked, and that I extended rather than rewrote:**

- `readiness.ts` — scores against *your own rolling fortnight*, not a population. An
  RHR of 54 is meaningless alone and means a lot when your baseline is 47. Already the
  Readiness score §6 asked for; it needed more inputs, not a new engine.
- `work.ts` — the prioritiser. Urgency, leverage, money, rot, fit; capacity from real
  slots; `atRisk` when the remaining work exceeds the capacity before the deadline.
  **This was already two-thirds of the planning engine** — it knew how much time you
  had and what had to fit in it.
- `knee.ts` — the plyometric ladder and the stop rule.
- `gym.ts` — the five-day split, with the race-week priming override.

**The one real architectural problem:** `lib/week.ts` hardcoded your week as a fixed
7-day template — Monday 08:15 gym, 10:15 RPM, Wednesday 14:15 drive to Aldershot. The
brief needs a *scheduler*.

I kept the file and demoted it. The timetable you already trusted is now **data**: the
genuinely immovable parts became recurring commitments the planner protects, and the
rest became free for it to arrange. Nothing was thrown away.

---

## What's new

### The planning engine

Three layers, each using only what the one above left:

1. **Fixed** — sleep, races, gates at Aldershot (with both 2h30 travel legs), meetings,
   anything you locked.
2. **Required** — the work that genuinely has to happen today for the deadlines to
   hold, plus the day's training. Four hours due Friday with three days left becomes
   ninety minutes today, not four hours on Thursday night. **Your estimate is never
   changed** — the planner decides when, not how long.
3. **Optional** — *one* high-value thing, chosen against a live goal, and only when
   there is genuinely room.

Then it stops. What's left is marked **Free**, with a reason, so it reads as a decision
rather than a planner that ran out of ideas. Free time has a floor you set, and the
planner will not fill below it.

Since you set your own hours, **RPM is a daily budget, not a block.** On a Wednesday it
worked out by itself that it could fit 5h15 of RPM in three chunks before the 15:30
drive — which is almost exactly the "compressed day, hard stop 14:00" you had written
by hand.

It also **refuses to invent work.** No deadlines today means no work scheduled, and it
says so rather than manufacturing something to look busy.

Replanning respects what you touched: **a locked block is never moved**, and anything
marked done or skipped stays put. Waking late rebuilds the rest of the day around the
time you actually got up.

### The Today Score

Measures **alignment, not output**:

- Readiness red and you rested → **full marks** on recovery. That is execution.
- Twelve hours of work scores **worse** than seven, unless a deadline forced it.
- Finishing the one job that mattered beats finishing four that didn't.
- Taking your free time counts. Skipping it costs you.
- Not enough logged → it says **"not enough logged to score today"** rather than
  producing a confident 71 built out of three unknowns.

### The morning check-in

Gates the app once a day, then gets out of the way. Times rather than totals (you
remember when you went up better than you can do the subtraction at 07:30), restedness,
energy, soreness, stress and motivation on ten-point scales, plus alcohol, late
caffeine, and what you trained yesterday.

The old five-point columns are kept in step automatically, so your rolling readiness
baseline doesn't break for a fortnight during the changeover.

### Calendar, goals, and tracking

- **Calendar** — agenda, month and week views; the source of truth the planner reads.
  Your seven hardcoded races were seeded in, so nothing was lost.
- **Goals** — the seven from your brief, with milestones, all editable and pausable.
  Progress knows which goals **improve by going down** (handicap, O-Barts, race
  position) and shows unmeasured goals as *unmeasured* rather than 0%.
- **Ski racing** — runs logged individually, totals **always computed**: best of runs 1
  and 2 plus run 3 for a Club National, run 1 plus run 2 for a Championship. The page
  shows which runs counted and which was dropped. **O-Barts points are entered by hand**
  — the official calculation depends on the field and on penalties this app doesn't
  hold, and a number invented here would look exactly like a real one.
- **Ski readiness** — technical, physical, performance, lifestyle. Names the weakest of
  the four rather than hiding it in an average.
- **Golf, personal brand, money** — each with a real empty state. Money allows blanks
  everywhere and never forces a made-up number.

### The interface

Rebuilt to the Apple Health standard: light ground, white rounded cards, one dark
section per screen carrying the number that matters, restrained blue accent, big
tabular numbers, progress rings, bottom navigation with safe-area support. **Every
existing class name still works**, so `/work`, `/gym`, `/knee`, `/log`, `/progress`
and the rest inherited the new look without being rewritten.

Navigation is the five you asked for: **Today · Calendar · Goals · Track · More.**

---

## Two bugs the build caught

Worth mentioning because they're the kind that survive into production:

1. **An all-day race was consuming the entire waking day**, leaving no room for meals,
   recovery or an evening. Fixed: an all-day event now occupies a sensible window by
   kind (a race 08:00–18:00, a holiday genuinely all day, a deadline no time at all —
   it's a date, not an appointment).

2. **Breakfast was being scheduled at 18:00** on a race day, because the first free gap
   after the wanted time was the only one there was. Anchors now have a tolerance: if
   there's no room near a meal's usual time, the plan says so rather than printing
   something obviously wrong. One line like that costs a page its credibility.

And one rule I added on the way: **a race day is not a work evening.** The app already
knows you're at Llandudno on Saturday, so it moves that work and tells you, rather than
scheduling a build for that night and marking it missed.

---

## How to deploy

1. **Replace the code.** Unzip over the project, or replace the repo contents and push.
2. **Run the migration.** Neon console → SQL Editor → paste all of
   `migration-performance-os.sql` → Run. Additive only; safe to re-run.
3. **Open More → The shape of a day.** Four numbers drive the whole planner: wake, bed,
   RPM hours a working day, and your free-time floor. The defaults are 07:30, 23:15,
   7 h and 2 h.
4. **Check More → Every week.** Wednesday gates at Aldershot is seeded with its 2h30
   travel each way. Add anything else genuinely immovable — and only those, or it
   stops being a plan and becomes a timetable you ignore.
5. **Goals** — put current values against the seven seeded goals and the bars come alive.

---

## What I deliberately did not build

Per §40, and so you can tell me if you disagree:

- **Drag-and-drop reordering.** Lock, skip, done and replan are there; dragging needs
  client-side state that would be the single biggest thing in the bundle. Worth doing
  once you know you want it.
- **Natural-language commands** ("I've got a ski session tomorrow at 10"). The brief
  called them secondary to a reliable engine, and it was right — the engine is the part
  that had to be solid first.
- **Subtasks and recurring tasks.** The columns exist in the schema; the UI doesn't yet.
  Next phase.
- **Phase 5 polish** — animations, charts, skeleton loading states. The structure is
  there and the app is fast; this is the layer that makes it feel finished.

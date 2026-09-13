# Gate to Gate

One system. The slalom build to the British Championships, the gym, the left leg,
the fuel, the races — and the work, with a prioritiser that knows exactly how few
evenings you actually have and tells you so.

Next.js + Postgres. Deploys to Vercel's free tier with a free Neon database.

---

## Putting it live — browser only, no terminal

You need three free accounts: **GitHub**, **Neon**, **Vercel**. Twenty minutes,
most of it waiting.

### 1. Put the code on GitHub

1. Go to **github.com/new**.
2. Repository name: `gate-to-gate`. Set it to **Private**. Click **Create repository**.
3. On the next page click **uploading an existing file**.
4. Unzip `gate-to-gate.zip` on your computer, open the folder, select
   **everything inside it** (not the folder itself) and drag it onto the page.
   The `app`, `lib` and `scripts` folders must come across too.
5. Scroll down, click **Commit changes**.

### 2. Make the database

1. Go to **neon.tech**, sign up, create a project. Any name, any region —
   London is closest.
2. In the project, open **SQL Editor** in the left sidebar.
3. Open `g2g-neon-setup.sql`, copy the whole thing, paste it into the editor,
   press **Run**. It creates every table and your login.
4. Now click **Connect** (or **Connection Details**) at the top. Copy the
   connection string — the long one starting `postgresql://`. Keep it somewhere
   for the next step.

### 3. Deploy

1. Go to **vercel.com**, sign in with GitHub, click **Add New → Project**.
2. Find `gate-to-gate` in the list and click **Import**.
3. Before deploying, open **Environment Variables** and add two:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string you copied |
   | `SESSION_SECRET` | any long random string — mash the keyboard for 50 characters |

   Make sure both are ticked for Production, Preview **and** Development.
4. Click **Deploy**. Two or three minutes.

### 4. Sign in

Open the URL Vercel gives you.

- Email: `reece@rpwebstudio.co.uk`
- Password: `GateToGate2027`

Add it to your phone's home screen — it is built for a 390px screen first.

---

## Two things worth doing on day one

**Set your real work capacity.** Settings → *Your real work capacity*. Every
number on the Work page is arithmetic against those minutes. Sunday's 90 is
ring-fenced; the evenings are defaults I guessed. If you will not genuinely use
Tuesday at 21:00, set it to 0 — an inflated slot makes the app cheerfully tell
you a job fits when it does not.

**Put your actual jobs in.** Estimate high. The prioritiser is only as honest as
the estimates, and the failure mode is always the same direction.

---

## How the work prioritiser decides

Each open job is scored out of 100:

| Factor | Weight | What it measures |
|---|---|---|
| Deadline | 40 | Whether the remaining work still *fits* in the slots you have before it is due — not just how close the date is |
| Unblocks | 18 | Whether finishing it frees something or someone else |
| Money | 18 | Value per remaining hour, relative to the best rate currently open to you |
| Been sitting | 16 | Days untouched, amplified if you flagged it as the one you avoid |
| Fits the slot | 8 | Whether it actually goes in your next free block |

Plus six points for anything already in progress, because finishing beats starting.

Two rules that matter more than the arithmetic:

- **Anything you are waiting on someone else for leaves the do-list entirely** and
  goes on a separate chase list. Leaving it in is how you feel busy while nothing
  moves.
- **Race weekends are not work evenings.** Race days and the evening before them
  are removed from your capacity automatically, which is the whole reason the
  training half and the work half live in one app.

---

## How the training engine decides

- **Blocks** set the gym days, the compound prescription and how much isolation
  work survives. Nine of them, 31 Aug 2026 → 25 Jul 2027.
- **The plyometric rung is the lower of what the block allows and what the graft's
  age allows.** A block never promotes a leg the calendar has not.
- **The stop rule is enforced from your log.** Swelling within 24 h of a plyo
  session drops you a rung for two weeks — and when there is no lower rung, the
  block comes out entirely.
- **Readiness is scored against your own rolling fortnight**, not against a
  population. An RHR of 54 means nothing on its own; 54 when you have been
  running at 47 means a great deal.
- **Race week rewrites the week** — Friday becomes a 25-minute priming session,
  Day 5 drops, the plunge comes out.

The knee page is monitoring, not diagnosis. The five red-flag symptoms listed
there go to a sports physio or your surgeon's team.

---

## Changing things later

Edit the file on GitHub, commit, and Vercel rebuilds in a couple of minutes.

**Important:** Vercel's **Redeploy** button rebuilds the *same commit*, not your
latest one. After editing a file, wait for the deployment that starts on its own.
The sign-in page prints a build number — bump `BUILD` in `app/login/page.tsx`
when you want to see at a glance which version is actually live.

Where things live:

| What | File |
|---|---|
| Blocks, races, bodyweight ramp, post-op clock | `lib/plan.ts` |
| The five-day split and its per-block scaling | `lib/gym.ts` |
| Plyo ladder, Knee 10, swelling and LSI rules | `lib/knee.ts` |
| The weekly timetable and your default work slots | `lib/week.ts` |
| Calories, macros, the repeat stack, the spa table | `lib/fuel.ts` |
| Readiness scoring | `lib/readiness.ts` |
| The work prioritiser | `lib/work.ts` |
| Which voice wins on a given day | `lib/coach.ts` |

Changing a race date or a block boundary is a one-line edit in `lib/plan.ts` and
everything else follows.

---

## Running it on your own machine (optional)

```bash
npm install
cp .env.example .env.local     # fill in DATABASE_URL and SESSION_SECRET
npm run db:init
npm run db:user reece@rpwebstudio.co.uk somepassword
npm run dev
```

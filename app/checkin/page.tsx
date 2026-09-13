import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { getSettings, getReadiness, recentReadiness } from '@/lib/db';
import { assess, sleepHoursFrom } from '@/lib/readiness';
import { toIso, fmtLong } from '@/lib/plan';
import { saveCheckInAction } from '../actions';
import Nav from '../_components/Nav';

export const dynamic = 'force-dynamic';

/**
 * The morning check-in.
 *
 * It gates the app once a day and then gets out of the way. Everything
 * downstream — the readiness verdict, whether today's session happens, the
 * shape of the timetable, the score tonight — is built on these numbers, and
 * inventing them would quietly corrupt all four.
 *
 * It is deliberately arranged so the first screenful is the part that matters
 * and takes about twenty seconds. Everything else is optional and folded away.
 */

function Ten({ name, label, low, high, value }: {
  name: string; label: string; low: string; high: string; value?: number | null;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="lab" style={{ marginBottom: 7 }}>{label}</div>
      <div className="scale10">
        {Array.from({ length: 10 }, (_, n) => n + 1).map((v) => (
          <span key={v} style={{ flex: 1, position: 'relative' }}>
            <input type="radio" id={`${name}-${v}`} name={name} value={v} defaultChecked={value === v} />
            <label htmlFor={`${name}-${v}`}>{v}</label>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
        <span className="xs">{low}</span>
        <span className="xs">{high}</span>
      </div>
    </div>
  );
}

export default async function CheckIn({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  if (!(await currentUser())) redirect('/login');
  const params = await searchParams;
  const day = params.day ?? toIso(new Date());

  const [settings, existing, history] = await Promise.all([
    getSettings(), getReadiness(day), recentReadiness(day, 30),
  ]);

  const done = !!existing?.checked_in_at;
  const verdict = existing ? assess(existing, history.filter((r) => r.day !== day)) : null;
  const sleepH = existing ? sleepHoursFrom(existing) : null;

  return (
    <div className="wrap">
      <header className="mast">
        <div>
          <div className="greet">{done ? 'Editing' : 'Before anything else'}</div>
          <h1>Check in</h1>
        </div>
      </header>

      {done && verdict ? (
        <div className={`verdict ${verdict.band}`}>
          <h2>Readiness {verdict.score} — {verdict.headline}</h2>
          <p>{verdict.action}</p>
          {sleepH != null && <p className="xs" style={{ marginTop: 8 }}>{sleepH.toFixed(1)} h of sleep logged.</p>}
        </div>
      ) : (
        <div className="note">
          <b>Thirty seconds, once a day.</b> Today&rsquo;s training decision, the shape of the
          timetable and tonight&rsquo;s score are all built on these numbers. It will not ask
          again — and you can come back and edit it whenever you like.
        </div>
      )}

      <form action={saveCheckInAction}>
        <input type="hidden" name="day" value={day} />

        {/* ------------------------------------------------------- sleep */}
        <div className="card">
          <h2>Last night</h2>
          <p className="desc">
            Times rather than a total — you remember when you went up far better than you can do
            the subtraction at half seven. The hours are worked out from them.
          </p>
          <div className="grid2">
            <label className="f">
              <span className="lab">Went to bed</span>
              <input type="time" name="bed_at" defaultValue={existing?.bed_at ?? ''} />
            </label>
            <label className="f">
              <span className="lab">Fell asleep (roughly)</span>
              <input type="time" name="asleep_at" defaultValue={existing?.asleep_at ?? ''} />
            </label>
          </div>
          <div className="grid2">
            <label className="f">
              <span className="lab">Woke up</span>
              <input type="time" name="woke_at" defaultValue={existing?.woke_at ?? ''} />
            </label>
            <label className="f">
              <span className="lab">Got out of bed</span>
              <input type="time" name="up_at" defaultValue={existing?.up_at ?? ''} />
            </label>
          </div>
          <label className="f" style={{ marginBottom: 0 }}>
            <span className="lab">Or just the total, in hours</span>
            <input type="number" step="any" name="sleep_h" inputMode="decimal"
              defaultValue={existing?.sleep_h ?? ''} placeholder="8.25" />
          </label>
        </div>

        {/* ------------------------------------------------------ how you are */}
        <div className="card">
          <h2>How you are</h2>
          <p className="desc">First instinct. Thinking about it does not make it more accurate.</p>
          <Ten name="rested" label="Restedness" low="Wrecked" high="Fully rested" value={existing?.rested} />
          <Ten name="energy" label="Energy" low="Flat" high="Buzzing" value={existing?.energy} />
          <Ten name="soreness" label="Muscle soreness" low="None" high="Very sore" value={existing?.soreness} />
          <Ten name="stress10" label="Stress" low="Calm" high="Fried" value={existing?.stress ? existing.stress * 2 : null} />
          <Ten name="motivation10" label="Motivation" low="Can't face it" high="Keen" value={existing?.motivation ? existing.motivation * 2 : null} />
        </div>

        {/* -------------------------------------------------------- last night */}
        <div className="card">
          <h2>Yesterday and last night</h2>
          <div className="row" style={{ marginBottom: 14 }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="checkbox" name="alcohol" defaultChecked={existing?.alcohol ?? false} />
              <span className="small">Had a drink</span>
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="checkbox" name="late_caffeine" defaultChecked={existing?.late_caffeine ?? false} />
              <span className="small">Late caffeine</span>
            </label>
          </div>
          <label className="f">
            <span className="lab">Training yesterday</span>
            <input type="text" name="trained_yday" defaultValue={existing?.trained_yday ?? ''}
              placeholder="Lower A, plus a walk" />
          </label>
          <label className="f" style={{ marginBottom: 0 }}>
            <span className="lab">Planned training today</span>
            <input type="text" name="planned_today" defaultValue={existing?.planned_today ?? ''}
              placeholder="Gates at Aldershot" />
          </label>
        </div>

        {/* ---------------------------------------------------------- extras */}
        <details className="card">
          <summary><h2>Numbers and anything unusual</h2></summary>
          <p className="desc" style={{ marginTop: 12 }}>
            All optional. Resting heart rate is the single most useful of them — it is measured
            against your own fortnight, not a population, so it only starts saying anything after
            a couple of weeks of entries.
          </p>
          <div className="grid2">
            <label className="f">
              <span className="lab">Resting HR</span>
              <input type="number" name="rhr" inputMode="numeric" defaultValue={existing?.rhr ?? ''} />
            </label>
            <label className="f">
              <span className="lab">Weight (kg)</span>
              <input type="number" step="any" name="weight_kg" inputMode="decimal"
                defaultValue={existing?.weight_kg ?? ''} placeholder={settings.weight_kg.toFixed(1)} />
            </label>
          </div>
          <label className="f">
            <span className="lab">Pain or body issues</span>
            <input type="text" name="pain_note" defaultValue={existing?.pain_note ?? ''}
              placeholder="Left knee a bit stiff on the stairs" />
          </label>
          <label className="f">
            <span className="lab">Anything unusual</span>
            <input type="text" name="unusual" defaultValue={existing?.unusual ?? ''} />
          </label>
          <label className="f" style={{ marginBottom: 0, display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="checkbox" name="illness" defaultChecked={existing?.illness ?? false} style={{ width: 20 }} />
            <span className="small">Unwell today</span>
          </label>
        </details>

        <button className="wide" type="submit">
          {done ? 'Save changes' : 'Start the day'}
        </button>
        <p className="xs center" style={{ marginTop: 12 }}>
          None of this is a medical measurement. It is a consistent way of asking the same
          questions every morning so the trend means something.
        </p>
      </form>

      <Nav active="/" />
    </div>
  );
}

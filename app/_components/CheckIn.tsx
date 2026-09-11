import { saveReadinessAction } from '../actions';
import { Readiness } from '@/lib/readiness';

function Scale({ name, label, low, high, value }: { name: string; label: string; low: string; high: string; value: number | null }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="lab" style={{ marginBottom: 4 }}>
        {label} <span style={{ textTransform: 'none', letterSpacing: 0 }}>· 1 {low} → 5 {high}</span>
      </div>
      <div className="scale5">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} style={{ flex: 1, position: 'relative' }}>
            <input type="radio" name={name} id={`${name}${n}`} value={n} defaultChecked={value === n} />
            <label htmlFor={`${name}${n}`}>{n}</label>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function CheckIn({ day, existing }: { day: string; existing: Readiness | null }) {
  return (
    <form action={saveReadinessAction} className="card">
      <h2>Morning check-in</h2>
      <p className="desc">
        Thirty seconds. Scored against your own fortnight, not against anyone else&rsquo;s — which is the only way the
        numbers mean anything.
      </p>
      <input type="hidden" name="day" value={day} />

      <div className="grid3">
        <label className="f">
          <span className="lab">Sleep (h)</span>
          <input type="number" step="any" name="sleep_h" defaultValue={existing?.sleep_h ?? ''} inputMode="decimal" />
        </label>
        <label className="f">
          <span className="lab">Resting HR</span>
          <input type="number" name="rhr" defaultValue={existing?.rhr ?? ''} inputMode="numeric" />
        </label>
        <label className="f">
          <span className="lab">Weight (kg)</span>
          <input type="number" step="any" name="weight_kg" defaultValue={existing?.weight_kg ?? ''} inputMode="decimal" />
        </label>
      </div>

      <Scale name="sleep_q" label="Sleep quality" low="broken" high="deep" value={existing?.sleep_q ?? null} />
      <Scale name="legs" label="Legs" low="wrecked" high="fresh" value={existing?.legs ?? null} />
      <Scale name="stress" label="Stress" low="calm" high="fried" value={existing?.stress ?? null} />
      <Scale name="work_load" label="Work load" low="quiet" high="buried" value={existing?.work_load ?? null} />
      <Scale name="motivation" label="Motivation" low="flat" high="keen" value={existing?.motivation ?? null} />

      <label className="f" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input type="checkbox" name="illness" defaultChecked={existing?.illness ?? false} style={{ width: 'auto' }} />
        <span>Unwell today</span>
      </label>

      <label className="f">
        <span className="lab">Anything worth noting</span>
        <textarea name="notes" defaultValue={existing?.notes ?? ''} placeholder="Niggles, a bad night, a heavy work day…" />
      </label>

      <button className="wide" type="submit">{existing ? 'Update check-in' : 'Save check-in'}</button>
    </form>
  );
}

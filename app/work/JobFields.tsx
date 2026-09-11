import { Job, KINDS } from '@/lib/work';

/** The shared field set for adding and editing a job. */
export default function JobFields({ job }: { job?: Job }) {
  return (
    <>
      {job && <input type="hidden" name="id" value={job.id} />}

      <label className="f">
        <span className="lab">What is it</span>
        <input type="text" name="title" defaultValue={job?.title ?? ''} required placeholder="Rebuild the booking form" />
      </label>

      <div className="grid2">
        <label className="f">
          <span className="lab">Client</span>
          <input type="text" name="client" defaultValue={job?.client ?? ''} placeholder="Blank if it's your own" />
        </label>
        <label className="f">
          <span className="lab">Type</span>
          <select name="kind" defaultValue={job?.kind ?? 'build'}>
            {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
        </label>
      </div>

      <div className="grid3">
        <label className="f">
          <span className="lab">Due</span>
          <input type="date" name="due" defaultValue={job?.due ?? ''} />
        </label>
        <label className="f">
          <span className="lab">Estimate (min)</span>
          <input type="number" name="est_min" step="any" defaultValue={job?.est_min ?? 60} inputMode="numeric" />
        </label>
        <label className="f">
          <span className="lab">Value (£)</span>
          <input type="number" name="value_gbp" step="any" defaultValue={job?.value_gbp ?? ''} inputMode="numeric" />
        </label>
      </div>

      <label className="f">
        <span className="lab">Waiting on someone?</span>
        <input type="text" name="waiting_on" defaultValue={job?.waiting_on ?? ''} placeholder="Their name — this moves it to the chase list" />
      </label>

      <label className="f">
        <span className="lab">Finishing this unblocks…</span>
        <input type="text" name="unblocks" defaultValue={job?.unblocks ?? ''} placeholder="Leave blank if it unblocks nothing" />
      </label>

      <div className="grid2">
        <label className="f" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="checkbox" name="dread" defaultChecked={job?.dread ?? false} style={{ width: 'auto' }} />
          <span className="small">The one I keep avoiding</span>
        </label>
        <label className="f">
          <span className="lab">Status</span>
          <select name="status" defaultValue={job?.status ?? 'todo'}>
            <option value="todo">To do</option>
            <option value="doing">In progress</option>
            <option value="parked">Parked</option>
          </select>
        </label>
      </div>

      <label className="f">
        <span className="lab">Notes</span>
        <textarea name="notes" defaultValue={job?.notes ?? ''} />
      </label>
    </>
  );
}

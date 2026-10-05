import { COMPLIANCE } from '@nawi/shared';
import { EmptyState } from '../../../components/ui/Feedback.jsx';
import { MethodToggle, NumInput, PassFail, RemoveButton, TableWrap, Value, ZeroReading, isChangepoint, td, th } from '../components.jsx';

export function TareForm({ form, readOnly }) {
  const { obs, set, replace, rowByKey, spec, result } = form;
  if (result.status === COMPLIANCE.NOT_APPLICABLE) {
    return (
      <EmptyState title="Not applicable">
        This instrument has no tare device. Set the tare device in the instrument specification if it has one.
      </EmptyState>
    );
  }
  const cp = isChangepoint(obs);
  const u = spec.unit;
  const points = obs.points ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Place the tare load and operate the tare function, then apply net loads up to Max − T. The MPE applies to the net load (R 76-1 3.5.3.3).
      </p>
      <div className="flex flex-wrap items-end gap-6">
        <label className="text-sm text-slate-700">
          Tare load T ({u})
          <NumInput label="Tare load" value={obs.tareLoad} readOnly={readOnly} onChange={(v) => set(['tareLoad'], v)} />
        </label>
        <MethodToggle form={form} readOnly={readOnly} />
      </div>
      <ZeroReading form={form} readOnly={readOnly} withLoad={false} label="Net zero after taring (E0)" />

      <TableWrap>
        <thead className="bg-slate-50">
          <tr>
            <th className={th}>Net load ({u})</th>
            <th className={th}>I ({u})</th>
            {cp && <th className={th}>ΔL ({u})</th>}
            <th className={`${th} text-right`}>E ({u})</th>
            <th className={`${th} text-right`}>Ec ({u})</th>
            <th className={`${th} text-right`}>MPE (±{u})</th>
            <th className={th}>Result</th>
            <th className={th} />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {points.map((p, i) => {
            const row = rowByKey[`${i}`];
            return (
              <tr key={i}>
                <td className={td}>
                  <NumInput label={`Net load ${i + 1}`} value={p.netLoad} readOnly={readOnly} invalid={Boolean(row?.invalid)} onChange={(v) => set(['points', i, 'netLoad'], v)} />
                </td>
                <td className={td}>
                  <NumInput label={`Net load ${i + 1} indication`} value={p.indication} readOnly={readOnly} invalid={Boolean(row?.invalid)} onChange={(v) => set(['points', i, 'indication'], v)} />
                </td>
                {cp && (
                  <td className={td}>
                    <NumInput label={`Net load ${i + 1} ΔL`} className="w-24" value={p.additionalLoad} readOnly={readOnly} invalid={Boolean(row?.invalid)} onChange={(v) => set(['points', i, 'additionalLoad'], v)} />
                  </td>
                )}
                <td className={`${td} text-right`}><Value v={row?.error} muted /></td>
                <td className={`${td} text-right`}><Value v={row?.correctedError} /></td>
                <td className={`${td} text-right`}><Value v={row?.mpe} muted /></td>
                <td className={td}><PassFail pass={row?.pass} /></td>
                <td className={td}>
                  <RemoveButton readOnly={readOnly} label={`Remove net load ${i + 1}`} onClick={() => replace({ ...obs, points: points.filter((_, j) => j !== i) })} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
      {!readOnly && (
        <button type="button" className="btn-secondary" onClick={() => replace({ ...obs, points: [...points, { netLoad: '', indication: '', additionalLoad: '' }] })}>
          + Add net load
        </button>
      )}
    </div>
  );
}

import { MethodToggle, NumInput, PassFail, RemoveButton, TableWrap, Value, isChangepoint, td, th } from '../components.jsx';

const blank = () => ({ indication: '', additionalLoad: '' });

export function RepeatabilityForm({ form, readOnly }) {
  const { obs, set, replace, rowByKey, spec, result } = form;
  const cp = isChangepoint(obs);
  const u = spec.unit;
  const series = obs.series ?? [];
  const summaries = Object.fromEntries((result.summary.series ?? []).map((s) => [s.key, s]));

  const updateReadings = (si, readings) => replace({ ...obs, series: series.map((s, j) => (j === si ? { ...s, readings } : s)) });

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Two series of weighings: one at about 50 % of Max and one near Max, returning to zero between weighings. The spread of errors in each series
        must not exceed the absolute MPE for that load.
      </p>
      <MethodToggle form={form} readOnly={readOnly} />

      <div className="grid gap-4 xl:grid-cols-2">
        {series.map((s, si) => {
          const summary = summaries[si];
          return (
            <section key={si} className="space-y-3 rounded-md border border-slate-200 p-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <label className="text-sm font-medium text-slate-700">
                  Series {si + 1} — load ({u})
                  <NumInput label={`Series ${si + 1} load`} value={s.load} readOnly={readOnly} onChange={(v) => set(['series', si, 'load'], v)} />
                </label>
                {summary && (
                  <p className="text-sm">
                    Spread <Value v={summary.spread} /> vs MPE <Value v={summary.mpe} /> — <PassFail pass={summary.pass} />
                  </p>
                )}
              </div>
              <TableWrap>
                <thead className="bg-slate-50">
                  <tr>
                    <th className={th}>#</th>
                    <th className={th}>I ({u})</th>
                    {cp && <th className={th}>ΔL ({u})</th>}
                    <th className={`${th} text-right`}>E ({u})</th>
                    <th className={th}>Result</th>
                    <th className={th} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(s.readings ?? []).map((r, ri) => {
                    const row = rowByKey[`${si}-${ri}`];
                    return (
                      <tr key={ri}>
                        <td className={`${td} text-slate-500`}>{ri + 1}</td>
                        <td className={td}>
                          <NumInput label={`Series ${si + 1} reading ${ri + 1} indication`} value={r.indication} readOnly={readOnly} invalid={Boolean(row?.invalid)} onChange={(v) => set(['series', si, 'readings', ri, 'indication'], v)} />
                        </td>
                        {cp && (
                          <td className={td}>
                            <NumInput label={`Series ${si + 1} reading ${ri + 1} ΔL`} className="w-24" value={r.additionalLoad} readOnly={readOnly} invalid={Boolean(row?.invalid)} onChange={(v) => set(['series', si, 'readings', ri, 'additionalLoad'], v)} />
                          </td>
                        )}
                        <td className={`${td} text-right`}><Value v={row?.error} /></td>
                        <td className={td}><PassFail pass={row?.pass} /></td>
                        <td className={td}>
                          <RemoveButton readOnly={readOnly} label="Remove reading" onClick={() => updateReadings(si, s.readings.filter((_, j) => j !== ri))} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
              {!readOnly && (
                <button type="button" className="btn-secondary" onClick={() => updateReadings(si, [...(s.readings ?? []), blank()])}>
                  + Add weighing
                </button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

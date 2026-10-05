import { suggestTestLoads, TEST_MODULES_BY_TYPE, TEST_TYPES } from '@nawi/shared';
import { MethodToggle, NumInput, PassFail, RemoveButton, TableWrap, Value, ZeroReading, isChangepoint, td, th } from '../components.jsx';

const blank = () => ({ indication: '', additionalLoad: '' });

function combine(a, b) {
  if (a?.pass === false || b?.pass === false) return false;
  if (a?.pass && b?.pass) return true;
  return undefined;
}

export function WeighingForm({ form, readOnly }) {
  const { obs, set, replace, rowByKey, spec } = form;
  const cp = isChangepoint(obs);
  const u = spec.unit;
  const points = obs.points ?? [];
  const suggested = suggestTestLoads(spec).weighing;

  const directionCells = (i, dir) => {
    const row = rowByKey[`${i}-${dir}`];
    const p = points[i][dir] ?? {};
    return (
      <>
        <td className={td}>
          <NumInput label={`Load ${i + 1} ${dir} indication`} value={p.indication} readOnly={readOnly} invalid={Boolean(row?.invalid)} onChange={(v) => set(['points', i, dir, 'indication'], v)} />
        </td>
        {cp && (
          <td className={td}>
            <NumInput label={`Load ${i + 1} ${dir} ΔL`} className="w-24" value={p.additionalLoad} readOnly={readOnly} invalid={Boolean(row?.invalid)} onChange={(v) => set(['points', i, dir, 'additionalLoad'], v)} />
          </td>
        )}
        <td className={`${td} text-right`}>
          <span className={row?.pass === false ? 'font-semibold text-red-700' : ''}>
            <Value v={row?.correctedError} />
          </span>
        </td>
      </>
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Apply loads increasing from zero to Max, then decreasing back to zero. At least 5 loads including Min, Max and the points where the MPE
        changes. Suggested: <span className="num">{suggested.join(', ')}</span> {u}.
      </p>
      <MethodToggle form={form} readOnly={readOnly} />
      <ZeroReading form={form} readOnly={readOnly} />

      <TableWrap>
        <thead className="bg-slate-50">
          <tr>
            <th className={th} rowSpan={2}>Load L ({u})</th>
            <th className={`${th} border-l border-slate-200 text-center`} colSpan={cp ? 3 : 2}>Increasing ↑</th>
            <th className={`${th} border-l border-slate-200 text-center`} colSpan={cp ? 3 : 2}>Decreasing ↓</th>
            <th className={`${th} border-l border-slate-200 text-right`} rowSpan={2}>MPE (±{u})</th>
            <th className={th} rowSpan={2}>Result</th>
            <th className={th} rowSpan={2} />
          </tr>
          <tr>
            {[0, 1].map((k) => (
              <FragmentHeaders key={k} cp={cp} u={u} />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {points.map((p, i) => {
            const up = rowByKey[`${i}-up`];
            const down = rowByKey[`${i}-down`];
            return (
              <tr key={i}>
                <td className={td}>
                  <NumInput label={`Load ${i + 1}`} value={p.load} readOnly={readOnly} invalid={Boolean(rowByKey[`${i}`]?.invalid)} onChange={(v) => set(['points', i, 'load'], v)} />
                </td>
                {directionCells(i, 'up')}
                {directionCells(i, 'down')}
                <td className={`${td} text-right`}><Value v={up?.mpe ?? down?.mpe} muted /></td>
                <td className={td}><PassFail pass={combine(up, down)} /></td>
                <td className={td}>
                  <RemoveButton readOnly={readOnly} label={`Remove load ${i + 1}`} onClick={() => replace({ ...obs, points: points.filter((_, j) => j !== i) })} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
      <p className="text-xs text-slate-500">Ec = E − E0 is shown for each direction.</p>

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => replace({ ...obs, points: [...points, { load: '', up: blank(), down: blank() }] })}>
            + Add load
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => replace({ ...TEST_MODULES_BY_TYPE[TEST_TYPES.WEIGHING].defaults(spec), method: obs.method, zero: obs.zero })}
          >
            Reset to suggested loads
          </button>
        </div>
      )}
    </div>
  );
}

function FragmentHeaders({ cp, u }) {
  return (
    <>
      <th className={`${th} border-l border-slate-200`}>I ({u})</th>
      {cp && <th className={th}>ΔL ({u})</th>}
      <th className={`${th} text-right`}>Ec ({u})</th>
    </>
  );
}

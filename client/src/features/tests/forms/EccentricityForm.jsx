import { ECCENTRICITY_POSITIONS } from '@nawi/shared';
import { MethodToggle, NumInput, PassFail, TableWrap, Value, ZeroReading, isChangepoint, td, th } from '../components.jsx';

/** Top view of the load receptor showing where each position is. */
function ReceptorDiagram({ rowByKey }) {
  const spots = { C: [60, 60], 1: [28, 28], 2: [92, 28], 3: [92, 92], 4: [28, 92] };
  const color = (id) => (rowByKey[id]?.pass === false ? '#b91c1c' : rowByKey[id]?.pass ? '#15803d' : '#64748b');
  return (
    <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0" role="img" aria-label="Load receptor positions">
      <rect x="4" y="4" width="112" height="112" rx="6" fill="#f8fafc" stroke="#94a3b8" />
      <line x1="60" y1="4" x2="60" y2="116" stroke="#e2e8f0" />
      <line x1="4" y1="60" x2="116" y2="60" stroke="#e2e8f0" />
      {Object.entries(spots).map(([id, [x, y]]) => (
        <g key={id}>
          <circle cx={x} cy={y} r="11" fill="#fff" stroke={color(id)} strokeWidth="2" />
          <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill={color(id)}>{id}</text>
        </g>
      ))}
    </svg>
  );
}

export function EccentricityForm({ form, readOnly }) {
  const { obs, set, rowByKey, spec, result } = form;
  const cp = isChangepoint(obs);
  const u = spec.unit;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-6">
        <ReceptorDiagram rowByKey={rowByKey} />
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-sm text-slate-600">
            Place a load of about 1/3 of Max at the centre and then in the middle of each quarter of the receptor. The corrected error at every
            position must stay within the MPE for that load.
          </p>
          <label className="block text-sm text-slate-700">
            Test load ({u})
            <NumInput label="Eccentricity test load" value={obs.load} readOnly={readOnly} onChange={(v) => set(['load'], v)} />
          </label>
          <MethodToggle form={form} readOnly={readOnly} />
        </div>
      </div>
      <ZeroReading form={form} readOnly={readOnly} />

      <TableWrap>
        <thead className="bg-slate-50">
          <tr>
            <th className={th}>Position</th>
            <th className={th}>I ({u})</th>
            {cp && <th className={th}>ΔL ({u})</th>}
            <th className={`${th} text-right`}>E ({u})</th>
            <th className={`${th} text-right`}>Ec ({u})</th>
            <th className={`${th} text-right`}>MPE (±{u})</th>
            <th className={th}>Result</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {ECCENTRICITY_POSITIONS.map((pos) => {
            const row = rowByKey[pos.id];
            const r = obs.positions?.[pos.id] ?? {};
            return (
              <tr key={pos.id}>
                <td className={`${td} font-medium`}>{pos.label}</td>
                <td className={td}>
                  <NumInput label={`${pos.label} indication`} value={r.indication} readOnly={readOnly} invalid={Boolean(row?.invalid)} onChange={(v) => set(['positions', pos.id, 'indication'], v)} />
                </td>
                {cp && (
                  <td className={td}>
                    <NumInput label={`${pos.label} ΔL`} className="w-24" value={r.additionalLoad} readOnly={readOnly} invalid={Boolean(row?.invalid)} onChange={(v) => set(['positions', pos.id, 'additionalLoad'], v)} />
                  </td>
                )}
                <td className={`${td} text-right`}><Value v={row?.error} muted /></td>
                <td className={`${td} text-right`}><Value v={row?.correctedError} /></td>
                <td className={`${td} text-right`}><Value v={row?.mpe ?? result.summary.mpe} muted /></td>
                <td className={td}><PassFail pass={row?.pass} /></td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
    </div>
  );
}

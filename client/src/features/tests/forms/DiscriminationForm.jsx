import { Dec } from '@nawi/shared';
import { NumInput, PassFail, TableWrap, Value, td, th } from '../components.jsx';

export function DiscriminationForm({ form, readOnly }) {
  const { obs, set, rowByKey, spec } = form;
  const u = spec.unit;
  const d = new Dec(spec.d || spec.e);
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        At Min, ½ Max and Max: with the load in place, note the indication, then gently add an extra load of 1.4d ={' '}
        <span className="num">{d.mul('1.4').toString()}</span> {u}. The indication must increase by at least d ={' '}
        <span className="num">{d.toString()}</span> {u}.
      </p>
      <TableWrap>
        <thead className="bg-slate-50">
          <tr>
            <th className={th}>Load ({u})</th>
            <th className={th}>I before ({u})</th>
            <th className={th}>I after +1.4d ({u})</th>
            <th className={`${th} text-right`}>Change ({u})</th>
            <th className={th}>Result</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(obs.points ?? []).map((p, i) => {
            const row = rowByKey[`${i}`];
            return (
              <tr key={i}>
                <td className={td}>
                  <NumInput label={`Load ${i + 1}`} value={p.load} readOnly={readOnly} onChange={(v) => set(['points', i, 'load'], v)} />
                </td>
                <td className={td}>
                  <NumInput label={`Load ${i + 1} indication before`} value={p.indicationBefore} readOnly={readOnly} invalid={Boolean(row?.invalid)} onChange={(v) => set(['points', i, 'indicationBefore'], v)} />
                </td>
                <td className={td}>
                  <NumInput label={`Load ${i + 1} indication after`} value={p.indicationAfter} readOnly={readOnly} invalid={Boolean(row?.invalid)} onChange={(v) => set(['points', i, 'indicationAfter'], v)} />
                </td>
                <td className={`${td} text-right`}><Value v={row?.change} /></td>
                <td className={td}><PassFail pass={row?.pass} /></td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
    </div>
  );
}

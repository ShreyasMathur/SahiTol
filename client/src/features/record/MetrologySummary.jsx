import { useMemo } from 'react';
import { mpeSchedule, VERIFICATION_TYPES } from '@nawi/shared';
import { Card } from '../../components/ui/Card.jsx';

const SECTION_LABELS = {
  manufacturer: 'Manufacturer',
  model: 'Model',
  instrument: 'Instrument specification',
  environment: 'Environment',
};

function SectionChecklist({ validation }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {Object.entries(validation.sections).map(([key, s]) => {
        const issues = Object.keys(s.errors).length;
        return (
          <li key={key} className="flex items-center justify-between gap-2">
            <span className="text-slate-700">{SECTION_LABELS[key]}</span>
            {issues === 0 ? (
              <span className="text-xs font-medium text-green-700">✓ Complete</span>
            ) : (
              <span className="text-xs font-medium text-red-700">
                ✕ {issues} {issues === 1 ? 'issue' : 'issues'}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Live derived values for the spec being entered: n, the Min lower limit and
 * the MPE schedule from the shared engine. Shown only once the spec is valid.
 */
export function MetrologySummary({ values, validation }) {
  const spec = values.instrument;
  const specResult = validation.sections.instrument;

  const schedule = useMemo(() => {
    if (!specResult.valid) return null;
    const initial = mpeSchedule({ ...spec, verificationType: VERIFICATION_TYPES.INITIAL });
    const inService = mpeSchedule({ ...spec, verificationType: VERIFICATION_TYPES.IN_SERVICE });
    return initial.map((row, i) => ({ ...row, inService: inService[i].mpe }));
  }, [spec, specResult.valid]);

  const { n, minRequired, minInE } = specResult.derived;

  return (
    <div className="space-y-4">
      <Card title="Completeness">
        <SectionChecklist validation={validation} />
      </Card>

      <Card title="Metrological summary" description="Computed per OIML R 76-1 Tables 3 & 6">
        {!schedule ? (
          <p className="text-sm text-slate-500">
            Enter a valid accuracy class, Max, Min and e to see derived values and the MPE schedule.
          </p>
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">n = Max / e</dt>
                <dd className="num text-lg font-semibold">{n}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Min lower limit ({minInE}e)</dt>
                <dd className="num text-lg font-semibold">
                  {minRequired} <span className="text-sm font-normal text-slate-500">{spec.unit}</span>
                </dd>
              </div>
            </dl>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="mb-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Maximum permissible errors (±{spec.unit})
                </caption>
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="py-1.5 pr-2 font-medium">Load m</th>
                    <th className="py-1.5 pr-2 text-right font-medium">Initial</th>
                    <th className="py-1.5 text-right font-medium">In service</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((r) => (
                    <tr key={r.from} className="border-b border-slate-100 last:border-0">
                      <td className="num py-1.5 pr-2">
                        {r.from === '0' ? '0' : `>${r.from}`} – {r.to}
                      </td>
                      <td className="num py-1.5 pr-2 text-right">
                        {r.mpe} <span className="text-xs text-slate-400">({r.mpeInE}e)</span>
                      </td>
                      <td className="num py-1.5 text-right">{r.inService}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

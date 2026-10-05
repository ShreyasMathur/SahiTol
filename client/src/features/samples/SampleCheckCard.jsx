import { TEST_MODULES } from '@nawi/shared';
import { ComplianceBadge } from '../../components/ui/StatusBadge.jsx';
import { Icon } from '../../components/ui/Icon.jsx';

/**
 * On a sample record: what the result should be (worked out by hand) next to
 * what the calculation engine produced, so any disagreement is obvious.
 */
export function SampleCheckCard({ record }) {
  const { sample, evaluation, compliance } = record;
  const rows = [
    ...TEST_MODULES.map((t) => ({ key: t.type, label: t.label, expected: sample.expected.tests[t.type], actual: evaluation.tests[t.type].status })),
    { key: 'overall', label: 'Overall result', expected: sample.expected.overall, actual: compliance, strong: true },
  ];
  const mismatches = rows.filter((r) => r.expected !== r.actual);
  const allMatch = mismatches.length === 0;

  return (
    <section className={`mb-6 rounded-xl border p-5 ${allMatch ? 'border-violet-200 bg-violet-50' : 'border-red-300 bg-red-50'}`}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="rounded-md bg-violet-600 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">Sample {sample.key}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-slate-900">{sample.title}</h2>
          <p className="mt-1 text-sm text-slate-700">{sample.purpose}</p>
        </div>
        <p className={`flex items-center gap-1.5 text-sm font-medium ${allMatch ? 'text-green-800' : 'text-red-800'}`}>
          <Icon name={allMatch ? 'check' : 'alert'} className="h-4 w-4" />
          {allMatch ? 'All results match the hand calculation' : `${mismatches.length} result${mismatches.length === 1 ? '' : 's'} differ from the hand calculation`}
        </p>
      </div>
      <div className="mt-4 overflow-x-auto rounded-lg border border-violet-100 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Test</th>
              <th className="px-4 py-2">Expected (by hand)</th>
              <th className="px-4 py-2">Calculated by the app</th>
              <th className="px-4 py-2">Agreement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.key} className={r.strong ? 'bg-slate-50 font-medium' : ''}>
                <td className="px-4 py-2">{r.label}</td>
                <td className="px-4 py-2"><ComplianceBadge value={r.expected} /></td>
                <td className="px-4 py-2"><ComplianceBadge value={r.actual} /></td>
                <td className="px-4 py-2">
                  {r.expected === r.actual ? (
                    <span className="text-green-700">✓ Match</span>
                  ) : (
                    <span className="font-medium text-red-700">✕ Differs</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Open a test to see every reading with its error and MPE. If you edit readings or the specification, the “calculated” column updates
        and may no longer match the original expectation.
      </p>
    </section>
  );
}

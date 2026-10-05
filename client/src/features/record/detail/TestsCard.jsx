import { Link } from 'react-router-dom';
import { COMPLIANCE, TEST_MODULES } from '@nawi/shared';
import { Card } from '../../../components/ui/Card.jsx';
import { ComplianceBadge } from '../../../components/ui/StatusBadge.jsx';

/** Applicable tests and how many already have a verdict. */
export function testProgress(record) {
  const results = Object.values(record.evaluation.tests).filter((r) => r.status !== COMPLIANCE.NOT_APPLICABLE);
  return { done: results.filter((r) => r.status !== COMPLIANCE.PENDING).length, total: results.length };
}

export function TestsCard({ record, canEnter }) {
  const { done, total } = testProgress(record);
  return (
    <Card
      title="OIML R 76 tests"
      description="Observations and verdict for each test procedure."
      actions={
        <div className="w-36 text-right">
          <p className="text-xs text-slate-500"><span className="num font-semibold text-slate-900">{done}</span> of {total} complete</p>
          <div className="mt-1 h-1.5 rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Tests completed">
            <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
        </div>
      }
    >
      <ul className="-my-3 divide-y divide-slate-100">
        {TEST_MODULES.map((t) => {
          const res = record.evaluation.tests[t.type];
          const hint = res.status === COMPLIANCE.PENDING ? res.issues[0] ?? res.notes : null;
          return (
            <li key={t.type} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{t.label}</p>
                <p className="text-xs text-slate-500">{t.reference}</p>
                {hint && <p className="mt-0.5 text-xs text-amber-700">{hint}</p>}
              </div>
              <div className="flex items-center gap-3">
                <ComplianceBadge value={res.status} />
                {res.status !== COMPLIANCE.NOT_APPLICABLE && (
                  <Link to={`/records/${record.id}/tests/${t.type}`} className="btn-secondary">
                    {canEnter ? (record.tests?.[t.type] ? 'Edit readings' : 'Enter readings') : 'View'}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

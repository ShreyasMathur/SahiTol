import { RECORD_STATUS } from '@nawi/shared';
import { Icon } from '../../../components/ui/Icon.jsx';
import { fmtDateTime } from '../../../lib/format.js';

const { DRAFT, IN_PROGRESS, SUBMITTED, APPROVED, REJECTED } = RECORD_STATUS;

/** Where the record is in draft → testing → review → approved, with the time of each step. */
export function LifecycleStepper({ record, progress }) {
  const reached = {
    [DRAFT]: 0,
    [IN_PROGRESS]: 1,
    [REJECTED]: 1,
    [SUBMITTED]: 2,
    [APPROVED]: 3,
  }[record.status];
  const rejected = record.status === REJECTED;

  const steps = [
    { label: 'Created', at: record.createdAt, by: record.createdByName },
    { label: 'Testing', at: null, by: null },
    {
      label: rejected ? 'Returned' : 'Submitted',
      at: rejected ? record.reviewedAt : record.submittedAt,
      by: rejected ? record.reviewedByName : null,
    },
    { label: 'Approved', at: record.status === APPROVED ? record.reviewedAt : null, by: record.status === APPROVED ? record.reviewedByName : null },
  ];

  return (
    <ol className="mb-6 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4 sm:gap-0 sm:p-0">
      {steps.map((s, i) => {
        const done = i < reached || (i === reached && record.status === APPROVED);
        const current = i === reached && record.status !== APPROVED;
        const failed = rejected && i === 2;
        const circle = failed
          ? 'bg-red-600 text-white'
          : done
            ? 'bg-brand-600 text-white'
            : current
              ? 'bg-white text-brand-700 ring-2 ring-brand-600'
              : 'bg-slate-100 text-slate-400';
        return (
          <li key={s.label} className={`relative flex items-center gap-3 sm:px-5 sm:py-4 ${i > 0 ? 'sm:border-l sm:border-slate-100' : ''}`}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${circle}`}>
              {failed ? <Icon name="x" className="h-4 w-4" /> : done ? <Icon name="check" className="h-4 w-4" /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className={`block text-sm font-medium ${done || current || failed ? 'text-slate-900' : 'text-slate-400'}`}>
                {s.label}
                {current && !failed && <span className="ml-1.5 text-xs font-normal text-brand-700">current</span>}
              </span>
              <span className="block truncate text-xs text-slate-500">
                {s.at && (done || failed || current || i === 0) ? fmtDateTime(s.at) : i === 1 && reached >= 1 ? `${progress.done} of ${progress.total} tests done` : '—'}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

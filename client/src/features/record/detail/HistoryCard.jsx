import { api } from '../../../api/client.js';
import { useAsync } from '../../../hooks/useAsync.js';
import { Card } from '../../../components/ui/Card.jsx';
import { ErrorBanner, Spinner } from '../../../components/ui/Feedback.jsx';
import { fmtDateTime } from '../../../lib/format.js';

const ACTION_LABELS = {
  created: 'Created record',
  updated: 'Edited details',
  submitted: 'Submitted for approval',
  approved: 'Approved',
  rejected: 'Rejected',
  superseded: 'Superseded',
  'revision created': 'Revision created',
  'photo added': 'Added photo',
  'photo removed': 'Removed photo',
};

const label = (action) =>
  ACTION_LABELS[action] ?? (action.startsWith('test:') ? `Recorded ${action.slice(5).replace(/([A-Z])/g, ' $1').toLowerCase()} readings` : action);

const show = (v) => (v === '' || v === null || v === undefined ? '∅' : String(v));

/** Audit trail: who changed what, and when. */
export function HistoryCard({ record }) {
  const { data, error, loading } = useAsync(() => api.records.audit(record.id), [record.id, record.updatedAt]);
  return (
    <Card title="History" description="Every change is logged with user and time.">
      {loading && !data && <Spinner />}
      <ErrorBanner error={error} />
      <ol className="space-y-3">
        {data?.map((e) => (
          <li key={e.id} className="border-l-2 border-slate-200 pl-3 text-sm">
            <p>
              <span className="font-medium text-slate-900">{label(e.action)}</span> <span className="text-slate-500">by {e.userName}</span>
            </p>
            <p className="text-xs text-slate-500">{fmtDateTime(e.at)}</p>
            {e.comment && <p className="mt-0.5 text-slate-700">“{e.comment}”</p>}
            {e.changes.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-brand-700">
                  {e.changes.length} field{e.changes.length === 1 ? '' : 's'} changed
                </summary>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {e.changes.slice(0, 50).map((c) => (
                    <li key={c.path} className="num break-all text-slate-600">
                      {c.path}: <span className="text-red-700 line-through">{show(c.from)}</span> → <span className="text-green-800">{show(c.to)}</span>
                    </li>
                  ))}
                  {e.changes.length > 50 && <li className="text-slate-500">…{e.changes.length - 50} more</li>}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

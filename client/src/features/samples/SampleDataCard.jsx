import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAsync } from '../../hooks/useAsync.js';
import { Card } from '../../components/ui/Card.jsx';
import { ErrorBanner } from '../../components/ui/Feedback.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { useToast } from '../../components/ui/Toast.jsx';

/**
 * Administrator control for the optional sample data: four reference weight sets
 * and four test records with known, hand-calculated verdicts.
 */
export function SampleDataCard({ onChange, compact = false }) {
  const toast = useToast();
  const status = useAsync(() => api.samples.status(), []);
  const [busy, setBusy] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const s = status.data;

  const run = async (key, fn, message) => {
    setBusy(key);
    try {
      const result = await fn();
      status.setData(result.status);
      toast.success(message(result));
      onChange?.();
    } catch (err) {
      toast.error('Sample data', err.message);
    } finally {
      setBusy(null);
      setConfirmRemove(false);
    }
  };

  const hasAny = s && (s.weightSets > 0 || s.records > 0);

  return (
    <Card
      title="Sample data"
      description={
        compact
          ? undefined
          : 'Optional. Four sample weight sets and four records whose pass/fail results were worked out by hand, to check the calculations before real use.'
      }
    >
      <ErrorBanner error={status.error} />
      {s && (
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">
            Loaded: <span className="num font-medium text-slate-900">{s.weightSets}</span> of {s.available.weightSets} weight sets ·{' '}
            <span className="num font-medium text-slate-900">{s.records}</span> of {s.available.records} records
            {s.records > 0 && (
              <>
                {' '}
                · <Link to="/repository?q=SAMPLE" className="text-brand-700 hover:underline">view sample records</Link>
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {s.weightSets < s.available.weightSets && (
              <button
                className="btn-secondary"
                disabled={Boolean(busy)}
                onClick={() => run('weights', api.samples.loadWeights, (r) => `Added ${r.added} sample weight set${r.added === 1 ? '' : 's'}`)}
              >
                <Icon name="scale" className="h-4 w-4" /> {busy === 'weights' ? 'Adding…' : 'Add sample weight sets'}
              </button>
            )}
            {s.records < s.available.records && (
              <button
                className="btn-primary"
                disabled={Boolean(busy)}
                onClick={() => run('records', api.samples.loadRecords, (r) => `Added ${r.added} sample record${r.added === 1 ? '' : 's'} (with their weight sets)`)}
              >
                <Icon name="file" className="h-4 w-4" /> {busy === 'records' ? 'Adding…' : 'Add sample test records'}
              </button>
            )}
            {hasAny &&
              (confirmRemove ? (
                <span className="flex items-center gap-2">
                  <button className="btn-danger" disabled={Boolean(busy)} onClick={() => run('remove', api.samples.remove, (r) => `Removed ${r.recordsRemoved} records and ${r.setsRemoved} weight sets`)}>
                    {busy === 'remove' ? 'Removing…' : 'Yes, remove all sample data'}
                  </button>
                  <button className="btn-ghost" onClick={() => setConfirmRemove(false)}>Cancel</button>
                </span>
              ) : (
                <button className="btn-ghost text-red-700 hover:bg-red-50 hover:text-red-800" disabled={Boolean(busy)} onClick={() => setConfirmRemove(true)}>
                  Remove sample data
                </button>
              ))}
          </div>
          {hasAny && (
            <p className="text-xs text-slate-500">
              Sample records are numbered <span className="num">SAMPLE/NAWI/…</span> and their reports are watermarked “Sample data — not valid”. Sample
              weight sets can be edited like any other; removing sample data keeps any weight set a real record uses.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

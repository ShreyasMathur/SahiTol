import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMass } from '@nawi/shared';
import { api } from '../../../api/client.js';
import { Card } from '../../../components/ui/Card.jsx';
import { ErrorBanner } from '../../../components/ui/Feedback.jsx';
import { PassFail, Tag } from '../../../components/ui/StatusBadge.jsx';

const today = () => new Date().toISOString().slice(0, 10);

/** Reference weight selection and the R 76-1 3.7.1 adequacy check. */
export function WeightsCard({ record, editable, onSaved }) {
  const check = record.weightsCheck;
  const [sets, setSets] = useState(null);
  const [selected, setSelected] = useState(record.referenceWeights ?? []);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (editing && !sets) api.weights.list().then(setSets).catch(setError);
  }, [editing, sets]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.records.update(record.id, { referenceWeights: selected });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const unit = record.instrument?.unit;

  return (
    <Card
      title="Reference weights"
      description="Standard weights used; errors must not exceed 1/3 of the instrument MPE (R 76-1 3.7.1)."
      actions={editable && !editing && <button className="btn-secondary" onClick={() => setEditing(true)}>Change</button>}
    >
      <div className="space-y-4">
        <ErrorBanner error={error} />
        {editing ? (
          <div className="space-y-3">
            {!sets && <p className="text-sm text-slate-500">Loading register…</p>}
            {sets?.filter((w) => w.active || selected.includes(w.id)).map((w) => {
              const expired = w.dueDate < (record.environment?.testDate || today());
              return (
                <label key={w.id} className="flex items-start gap-3 rounded-md border border-slate-200 p-3 text-sm hover:bg-slate-50">
                  <input type="checkbox" className="mt-0.5" checked={selected.includes(w.id)} onChange={() => toggle(w.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-slate-900">{w.name}</span>{' '}
                    <span className="text-slate-500">
                      · Class {w.class} · {formatMass(w.minNominal)} – {formatMass(w.maxNominal)} · Cert. {w.certificateNo}
                    </span>
                  </span>
                  {expired ? <Tag tone="red">Expired {w.dueDate}</Tag> : <Tag>Due {w.dueDate}</Tag>}
                </label>
              );
            })}
            <p className="text-xs text-slate-500">
              Missing a set? {<Link to="/weights" className="text-brand-700 hover:underline">Open the reference weights register</Link>}.
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => { setSelected(record.referenceWeights ?? []); setEditing(false); }}>Cancel</button>
              <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save selection'}</button>
            </div>
          </div>
        ) : check.selected.length ? (
          <ul className="space-y-1 text-sm">
            {check.selected.map((w) => (
              <li key={w.id}>
                <span className="font-medium">{w.name}</span>{' '}
                <span className="text-slate-500">
                  · Class {w.class} · Cert. {w.certificateNo} · due {w.dueDate}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No reference weights selected yet.</p>
        )}

        {!editing && check.loads.length > 0 && (
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Load ({unit})</th>
                  <th className="px-3 py-2 text-right font-medium">Weights MPE (mg)</th>
                  <th className="px-3 py-2 text-right font-medium">Limit ⅓ MPE (mg)</th>
                  <th className="px-3 py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {check.loads.map((l) => (
                  <tr key={l.load}>
                    <td className="num px-3 py-1.5">{l.load}</td>
                    <td className="num px-3 py-1.5 text-right">{l.covered ? l.weightsMpeMg : '—'}</td>
                    <td className="num px-3 py-1.5 text-right">{l.limitMg}</td>
                    <td className="px-3 py-1.5">{l.covered ? <PassFail pass={l.pass} /> : <span className="text-red-700">Not covered</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!editing && (check.issues.length > 0 || check.warnings.length > 0) && (
          <ul className="space-y-1 text-sm">
            {check.issues.map((i) => <li key={i} className="text-red-700">✕ {i}</li>)}
            {check.warnings.map((w) => <li key={w} className="text-amber-700">⚠ {w}</li>)}
          </ul>
        )}
      </div>
    </Card>
  );
}

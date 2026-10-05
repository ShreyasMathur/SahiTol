import { useState } from 'react';
import { SAMPLE_CERT_PREFIX, WEIGHT_CLASSES, WEIGHT_NOMINALS, formatMass, validateWeightSet } from '@nawi/shared';
import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { Card } from '../components/ui/Card.jsx';
import { EmptyState, ErrorBanner, Spinner } from '../components/ui/Feedback.jsx';
import { SelectField, TextField } from '../components/ui/FormField.jsx';
import { Tag } from '../components/ui/StatusBadge.jsx';
import { SampleDataCard } from '../features/samples/SampleDataCard.jsx';

const NOMINAL_OPTIONS = [...WEIGHT_NOMINALS].reverse().map((g) => ({ value: g, label: formatMass(g) }));
const CLASS_OPTIONS = WEIGHT_CLASSES.map((c) => ({ value: c, label: `Class ${c}` }));
const EMPTY = { name: '', class: 'F1', minNominal: '0.001', maxNominal: '5000', certificateNo: '', calibrationLab: '', calibratedOn: '', dueDate: '', active: true };
const DAY = 86_400_000;

function validity(w) {
  if (!w.active) return <Tag>Inactive</Tag>;
  const days = (new Date(w.dueDate) - new Date()) / DAY;
  if (days < 0) return <Tag tone="red">Expired</Tag>;
  if (days < 30) return <Tag tone="amber">Due in {Math.ceil(days)} d</Tag>;
  return <Tag tone="green">Valid</Tag>;
}

function WeightSetForm({ initial, onCancel, onSaved }) {
  const [w, setW] = useState(initial);
  const [shown, setShown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { errors, valid } = validateWeightSet(w);
  const f = (field) => ({ value: w[field] ?? '', onChange: (e) => setW({ ...w, [field]: e.target.value }), error: shown ? errors[field] : undefined });

  const save = async (e) => {
    e.preventDefault();
    setShown(true);
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      if (w.id) await api.weights.update(w.id, w);
      else await api.weights.create(w);
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={w.id ? `Edit ${initial.name}` : 'Add weight set'}>
      <form onSubmit={save} className="space-y-4" noValidate>
        <ErrorBanner error={error} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField label="Name / ID" required className="sm:col-span-2" {...f('name')} />
          <SelectField label="OIML R 111 class" required options={CLASS_OPTIONS} {...f('class')} />
          <div />
          <SelectField label="Smallest weight" required options={NOMINAL_OPTIONS} {...f('minNominal')} />
          <SelectField label="Largest weight" required options={NOMINAL_OPTIONS} {...f('maxNominal')} />
          <TextField label="Calibration certificate no." required {...f('certificateNo')} />
          <TextField label="Calibrated by" {...f('calibrationLab')} />
          <TextField label="Calibration date" type="date" {...f('calibratedOn')} />
          <TextField label="Calibration due" type="date" required {...f('dueDate')} />
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
            <input type="checkbox" checked={w.active} onChange={(e) => setW({ ...w, active: e.target.checked })} /> Active
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Card>
  );
}

export function WeightsPage() {
  const { can } = useAuth();
  const manage = can('weights:manage');
  const { data, error, loading, reload } = useAsync(() => api.weights.list(), []);
  const [editing, setEditing] = useState(null);

  return (
    <>
      <PageHeader
        title="Reference weights"
        subtitle="Register of standard weight sets (OIML R 111) with calibration traceability."
        actions={manage && !editing && <button className="btn-primary" onClick={() => setEditing(EMPTY)}>+ Add weight set</button>}
      />
      {editing && (
        <div className="mb-6">
          <WeightSetForm key={editing.id ?? 'new'} initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
        </div>
      )}
      <Card>
        <ErrorBanner error={error} />
        {loading && !data && <Spinner />}
        {data && !data.length && <EmptyState title="No weight sets registered" />}
        {data?.length > 0 && (
          <div className="-m-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Weight set</th>
                  <th className="px-4 py-2.5">Class</th>
                  <th className="px-4 py-2.5">Range</th>
                  <th className="px-4 py-2.5">Certificate</th>
                  <th className="px-4 py-2.5">Due</th>
                  <th className="px-4 py-2.5">Status</th>
                  {manage && <th className="px-4 py-2.5" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((w) => (
                  <tr key={w.id} className={w.active ? '' : 'text-slate-400'}>
                    <td className="px-4 py-2.5 font-medium">
                      {w.name}
                      {w.certificateNo.startsWith(SAMPLE_CERT_PREFIX) && <span className="ml-2"><Tag tone="blue">Sample</Tag></span>}
                    </td>
                    <td className="px-4 py-2.5">{w.class}</td>
                    <td className="num whitespace-nowrap px-4 py-2.5">{formatMass(w.minNominal)} – {formatMass(w.maxNominal)}</td>
                    <td className="px-4 py-2.5">
                      <div className="num">{w.certificateNo}</div>
                      <div className="text-xs text-slate-500">{w.calibrationLab}</div>
                    </td>
                    <td className="num whitespace-nowrap px-4 py-2.5">{w.dueDate}</td>
                    <td className="px-4 py-2.5">{validity(w)}</td>
                    {manage && (
                      <td className="px-4 py-2.5 text-right">
                        <button className="text-brand-700 hover:underline" onClick={() => setEditing(w)}>Edit</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {can('users:manage') && (
        <div className="mt-6">
          <SampleDataCard onChange={reload} />
        </div>
      )}
    </>
  );
}

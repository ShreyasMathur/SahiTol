import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { EDITABLE_STATUSES, RECORD_STATUS } from '@nawi/shared';
import { api } from '../api/client.js';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { ErrorBanner, Spinner } from '../components/ui/Feedback.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { useRecordForm, FORM_SECTIONS, EMPTY_RECORD } from '../features/record/useRecordForm.js';
import { useToast } from '../components/ui/Toast.jsx';
import { ManufacturerSection } from '../features/record/sections/ManufacturerSection.jsx';
import { ModelSection } from '../features/record/sections/ModelSection.jsx';
import { InstrumentSpecSection } from '../features/record/sections/InstrumentSpecSection.jsx';
import { EnvironmentSection } from '../features/record/sections/EnvironmentSection.jsx';
import { MetrologySummary } from '../features/record/MetrologySummary.jsx';

/** Create (/records/new) or edit (/records/:id/edit) a record's data-entry sections. */
export function RecordEditorPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const fromId = id ? null : searchParams.get('from');
  const navigate = useNavigate();
  const toast = useToast();
  const [template, setTemplate] = useState(null);
  const form = useRecordForm();
  const { reset } = form;
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(Boolean(id || fromId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    api.records
      .get(id)
      .then((r) => {
        setRecord(r);
        reset(r);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id, reset]);

  // "Duplicate": same manufacturer, model and specification; new serial number and fresh test conditions.
  useEffect(() => {
    if (!fromId) return;
    api.records
      .get(fromId)
      .then((r) => {
        setTemplate(r);
        reset({
          manufacturer: r.manufacturer,
          model: { ...r.model, serialNumber: '' },
          instrument: r.instrument,
          environment: { ...EMPTY_RECORD.environment, labName: r.environment?.labName ?? '' },
        });
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [fromId, reset]);

  const readOnly = record && (!EDITABLE_STATUSES.includes(record.status) || record.supersededBy);
  const isDraft = !record || record.status === RECORD_STATUS.DRAFT;
  const testsStarted = record && Object.keys(record.tests ?? {}).length > 0;

  const save = async (status) => {
    if (status !== RECORD_STATUS.DRAFT && !form.validation.valid) {
      form.revealAll();
      document.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { ...Object.fromEntries(FORM_SECTIONS.map((s) => [s, form.values[s]])), status };
      const saved = id ? await api.records.update(id, payload) : await api.records.create(payload);
      toast.success(
        id ? 'Changes saved' : `Record ${saved.referenceNo} created`,
        status === RECORD_STATUS.DRAFT ? 'Saved as a draft.' : id ? undefined : 'Next: enter the test observations.',
      );
      navigate(`/records/${saved.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title={id ? `Edit ${record?.referenceNo ?? 'record'}` : 'New test record'}
        subtitle="Instrument identification, metrological characteristics and test conditions."
        actions={record && <StatusBadge status={record.status} />}
      />

      {readOnly && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This record is {record.status.toLowerCase()} and can no longer be edited.
        </div>
      )}
      {template && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Prefilled from <Link to={`/records/${template.id}`} className="num font-medium underline">{template.referenceNo}</Link>. Enter the
          serial number of this unit and today&rsquo;s test conditions.
        </div>
      )}
      <div className="mb-4">
        <ErrorBanner error={error} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <form className="space-y-6" onSubmit={(e) => e.preventDefault()} noValidate>
          <ManufacturerSection bind={form.bind} disabled={readOnly} />
          <ModelSection bind={form.bind} disabled={readOnly} />
          <InstrumentSpecSection bind={form.bind} values={form.values} disabled={readOnly} />
          <EnvironmentSection bind={form.bind} disabled={readOnly} />

          {!readOnly && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
              {testsStarted && (
                <p className="mr-auto text-xs text-amber-800">
                  ⚠ Changing the specification re-evaluates all test results against the new MPEs.
                </p>
              )}
              <Link to={id ? `/records/${id}` : '/'} className="btn-secondary">Cancel</Link>
              {isDraft && (
                <button type="button" className="btn-secondary" disabled={saving} onClick={() => save(RECORD_STATUS.DRAFT)}>
                  Save draft
                </button>
              )}
              <button type="button" className="btn-primary" disabled={saving} onClick={() => save(RECORD_STATUS.IN_PROGRESS)}>
                {saving ? 'Saving…' : isDraft ? 'Save & continue to tests' : 'Save changes'}
              </button>
            </div>
          )}
        </form>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <MetrologySummary values={form.values} validation={form.validation} />
        </aside>
      </div>
    </>
  );
}

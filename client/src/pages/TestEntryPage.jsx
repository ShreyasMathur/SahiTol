import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EDITABLE_STATUSES, RECORD_STATUS, ROLES, TEST_MODULES, TEST_MODULES_BY_TYPE, testApplies } from '@nawi/shared';
import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { Card } from '../components/ui/Card.jsx';
import { EmptyState, ErrorBanner, Spinner } from '../components/ui/Feedback.jsx';
import { ComplianceBadge } from '../components/ui/StatusBadge.jsx';
import { useTestForm } from '../features/tests/useTestForm.js';
import { IssuesPanel } from '../features/tests/components.jsx';
import { TEST_FORMS } from '../features/tests/index.js';
import { useToast } from '../components/ui/Toast.jsx';

export function TestEntryPage() {
  const { id, testType } = useParams();
  const { data: record, error, loading } = useAsync(() => api.records.get(id), [id]);

  if (!TEST_MODULES_BY_TYPE[testType]) return <EmptyState title="Unknown test type" />;
  if (loading && !record) return <Spinner />;
  if (error) return <ErrorBanner error={error} />;
  // Keyed so switching tests starts from that test's saved observations.
  return <TestEntry key={`${id}:${testType}:${record.updatedAt}`} record={record} type={testType} />;
}

function TestTabs({ record, current, liveStatus, dirty, onBlocked }) {
  return (
    <nav className="mb-4 flex flex-wrap gap-2" aria-label="Tests">
      {TEST_MODULES.map((t) => {
        const active = t.type === current;
        const status = active ? liveStatus : record.evaluation.tests[t.type].status;
        return (
          <Link
            key={t.type}
            to={`/records/${record.id}/tests/${t.type}`}
            onClick={(e) => {
              if (dirty && !active) {
                e.preventDefault();
                onBlocked();
              }
            }}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
              active ? 'border-brand-500 bg-brand-50 font-medium text-brand-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t.label}
            <ComplianceBadge value={status} />
          </Link>
        );
      })}
    </nav>
  );
}

function TestEntry({ record, type }) {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const form = useTestForm(record, type);
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const Form = TEST_FORMS[type];

  const isOwner = user.role === ROLES.ADMIN || record.createdBy === user.id;
  const locked = !EDITABLE_STATUSES.includes(record.status) || Boolean(record.supersededBy);
  const isDraft = record.status === RECORD_STATUS.DRAFT;
  const editable = can('record:edit') && isOwner && !locked && !isDraft;

  const index = TEST_MODULES.findIndex((t) => t.type === type);
  const next = TEST_MODULES.slice(index + 1).find((t) => testApplies(t, record.instrument));

  useEffect(() => {
    if (!form.dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [form.dirty]);

  /** where: 'next' test, back to the 'record', or 'stay' on this test (Ctrl+S). */
  const save = async (where) => {
    setSaving(true);
    setError(null);
    try {
      await api.records.saveTest(record.id, type, form.obs);
      form.markSaved();
      toast.success(`${form.module.label} saved`, `Result: ${{ PASS: 'pass', FAIL: 'fail', PENDING: 'incomplete', NA: 'not applicable' }[form.result.status] ?? form.result.status}`);
      if (where !== 'stay') navigate(where === 'next' && next ? `/records/${record.id}/tests/${next.type}` : `/records/${record.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (!editable) return undefined;
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveRef.current('stay');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editable]);

  return (
    <>
      <PageHeader
        title={form.module.label}
        subtitle={`${record.referenceNo} · ${record.manufacturer?.name ?? ''} ${record.model?.modelName ?? ''} · ${form.module.reference}`}
        actions={<Link to={`/records/${record.id}`} className="btn-secondary">Back to record</Link>}
      />

      <TestTabs record={record} current={type} liveStatus={form.result.status} dirty={form.dirty} onBlocked={() => setBlocked(true)} />

      {blocked && form.dirty && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          You have unsaved readings. Save them before switching tests.
        </div>
      )}
      {isDraft && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Complete the instrument details and choose “Save &amp; continue to tests” before entering observations.{' '}
          <Link className="font-medium underline" to={`/records/${record.id}/edit`}>Edit details</Link>
        </div>
      )}
      {!isDraft && !editable && (
        <p className="mb-4 text-sm text-slate-500">
          {locked ? 'This record is locked, so observations are read-only.' : 'Read-only: only the technician who created this record can enter observations.'}
        </p>
      )}

      <Card
        title="Observations"
        actions={
          <span className="flex items-center gap-2 text-sm text-slate-600">
            Live result <ComplianceBadge value={form.result.status} />
          </span>
        }
      >
        <div className="space-y-4">
          <Form form={form} readOnly={!editable} />
          <IssuesPanel result={form.result} />
        </div>
      </Card>

      {editable && (
        <div className="sticky bottom-0 z-20 -mx-4 mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="mr-auto">
            <ErrorBanner error={error} />
            {!error && form.dirty && (
              <span className="text-sm text-amber-700">
                Unsaved changes <span className="ml-1 hidden text-xs text-slate-400 sm:inline">· <span className="kbd">Ctrl S</span> to save</span>
              </span>
            )}
          </div>
          <button type="button" className="btn-secondary" disabled={saving} onClick={() => save('record')}>
            Save &amp; close
          </button>
          {next && (
            <button type="button" className="btn-primary" disabled={saving} onClick={() => save('next')}>
              {saving ? 'Saving…' : `Save & next: ${next.label}`}
            </button>
          )}
        </div>
      )}
    </>
  );
}

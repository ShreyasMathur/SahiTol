import { Link, useParams } from 'react-router-dom';
import { ACCURACY_CLASS_LABELS, EDITABLE_STATUSES, RECORD_STATUS, ROLES, TARE_DEVICES } from '@nawi/shared';
import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { Card } from '../components/ui/Card.jsx';
import { ErrorBanner, Spinner } from '../components/ui/Feedback.jsx';
import { ComplianceBadge, StatusBadge, Tag } from '../components/ui/StatusBadge.jsx';
import { TestsCard, testProgress } from '../features/record/detail/TestsCard.jsx';
import { LifecycleStepper } from '../features/record/detail/LifecycleStepper.jsx';
import { Icon } from '../components/ui/Icon.jsx';
import { SampleCheckCard } from '../features/samples/SampleCheckCard.jsx';
import { WeightsCard } from '../features/record/detail/WeightsCard.jsx';
import { PhotosCard } from '../features/record/detail/PhotosCard.jsx';
import { WorkflowCard } from '../features/record/detail/WorkflowCard.jsx';
import { ReportCard } from '../features/record/detail/ReportCard.jsx';
import { SignaturesCard } from '../features/record/detail/SignaturesCard.jsx';
import { HistoryCard } from '../features/record/detail/HistoryCard.jsx';
import { fmtDateTime } from '../lib/format.js';

function Fields({ rows }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-slate-500">{label}</dt>
          <dd className="font-medium text-slate-900">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

function Banners({ record }) {
  return (
    <div className="mb-4 space-y-2 empty:hidden">
      {record.supersededBy && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This record has been superseded by{' '}
          <Link to={`/records/${record.supersededBy}`} className="font-medium underline">{record.supersededByRef}</Link>. It remains on file unchanged.
        </div>
      )}
      {record.revisionOf && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Revision {record.revision} of <Link to={`/records/${record.revisionOf}`} className="font-medium underline">{record.revisionOfRef}</Link>.
        </div>
      )}
      {record.status === RECORD_STATUS.REJECTED && record.reviewComment && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <span className="font-medium">Returned by {record.reviewedByName}:</span> {record.reviewComment}
        </div>
      )}
      {record.status === RECORD_STATUS.APPROVED && record.reviewComment && (
        <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm">
          <span className="font-medium">Inspector remarks:</span> {record.reviewComment}
        </div>
      )}
    </div>
  );
}

export function RecordDetailPage() {
  const { id } = useParams();
  const { user, can } = useAuth();
  const { data: record, error, loading, reload } = useAsync(() => api.records.get(id), [id]);

  if (loading && !record) return <Spinner />;
  if (!record) return <ErrorBanner error={error} />;

  const { manufacturer = {}, model = {}, instrument = {}, environment = {} } = record;
  const isOwner = user.role === ROLES.ADMIN || record.createdBy === user.id;
  const editable = can('record:edit') && isOwner && EDITABLE_STATUSES.includes(record.status) && !record.supersededBy;
  const testsOpen = editable && record.status !== RECORD_STATUS.DRAFT;

  return (
    <>
      <PageHeader
        title={record.referenceNo}
        subtitle={[manufacturer.name, model.modelName, model.serialNumber && `S/N ${model.serialNumber}`].filter(Boolean).join(' · ')}
        actions={
          <>
            {record.supersededBy && <Tag tone="amber">Superseded</Tag>}
            <StatusBadge status={record.status} />
            <ComplianceBadge value={record.compliance} />
            {can('record:create') && (
              <Link to={`/records/new?from=${id}`} className="btn-secondary" title="Start a new record for another unit of the same model">
                <Icon name="copy" className="h-4 w-4" /> Duplicate
              </Link>
            )}
            {editable && (
              <Link to={`/records/${id}/edit`} className="btn-secondary">
                <Icon name="edit" className="h-4 w-4" /> Edit details
              </Link>
            )}
          </>
        }
      />
      <ErrorBanner error={error} />
      {record.sample && <SampleCheckCard record={record} />}
      <LifecycleStepper record={record} progress={testProgress(record)} />
      <Banners record={record} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card title="Instrument">
            <Fields
              rows={[
                ['Manufacturer', manufacturer.name],
                ['Model / serial', [model.modelName, model.serialNumber].filter(Boolean).join(' / ')],
                ['Type', instrument.instrumentType],
                ['Accuracy class', ACCURACY_CLASS_LABELS[instrument.accuracyClass]],
                ['Max / Min', instrument.maxCapacity && `${instrument.maxCapacity} / ${instrument.minCapacity ?? '—'} ${instrument.unit}`],
                ['e / d', instrument.e && `${instrument.e} / ${instrument.d || instrument.e} ${instrument.unit}`],
                ['Tare device', instrument.tareDevice && instrument.tareDevice !== TARE_DEVICES.NONE ? `${instrument.tareDevice}${instrument.maxTare ? `, T = ${instrument.maxTare} ${instrument.unit}` : ''}` : 'None'],
                ['Created by', `${record.createdByName ?? '—'} · ${fmtDateTime(record.createdAt)}`],
              ]}
            />
          </Card>
          <Card title="Test conditions">
            <Fields
              rows={[
                ['Laboratory', environment.labName],
                ['Test date', environment.testDate],
                ['Temperature', environment.temperatureStart && `${environment.temperatureStart} → ${environment.temperatureEnd || '?'} °C`],
                ['Humidity', environment.humidityStart && `${environment.humidityStart} → ${environment.humidityEnd || '?'} %RH`],
                ['Pressure', environment.pressure && `${environment.pressure} hPa`],
              ]}
            />
          </Card>
          <TestsCard record={record} canEnter={testsOpen} />
          <WeightsCard record={record} editable={editable} onSaved={reload} />
          <PhotosCard record={record} editable={editable} />
        </div>

        <aside className="space-y-4">
          <WorkflowCard record={record} onDone={reload} />
          <ReportCard record={record} />
          <SignaturesCard record={record} />
          <HistoryCard record={record} />
        </aside>
      </div>
    </>
  );
}

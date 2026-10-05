import { Link } from 'react-router-dom';
import { RECORD_STATUS, ROLES } from '@nawi/shared';
import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { Card } from '../components/ui/Card.jsx';
import { EmptyState, ErrorBanner, Spinner } from '../components/ui/Feedback.jsx';
import { Icon } from '../components/ui/Icon.jsx';
import { ComplianceBadge, StatusBadge } from '../components/ui/StatusBadge.jsx';
import { Can } from '../components/auth/RequirePermission.jsx';
import { RecordsTable } from '../features/record/RecordsTable.jsx';
import { Legend, MonthlyChart, OUTCOME_SERIES, PipelineBar } from '../features/dashboard/charts.jsx';
import { SampleDataCard } from '../features/samples/SampleDataCard.jsx';
import { fmtDate, fmtHours, timeAgo } from '../lib/format.js';

const { DRAFT, IN_PROGRESS, SUBMITTED, APPROVED, REJECTED } = RECORD_STATUS;

const TILES = [
  { key: 'inProcess', label: 'In process', statuses: [DRAFT, IN_PROGRESS], hint: 'Drafts and tests underway', icon: 'edit', tone: 'text-blue-700 bg-blue-50', color: '#2563eb' },
  { key: 'submitted', label: 'Awaiting approval', statuses: [SUBMITTED], hint: 'Submitted to inspector', icon: 'inbox', tone: 'text-amber-700 bg-amber-50', color: '#d97706' },
  { key: 'approved', label: 'Completed', statuses: [APPROVED], hint: 'Approved reports', icon: 'shield', tone: 'text-green-700 bg-green-50', color: '#16a34a' },
  { key: 'rejected', label: 'Returned', statuses: [REJECTED], hint: 'Rejected, needs rework', icon: 'alert', tone: 'text-red-700 bg-red-50', color: '#dc2626' },
];

function StatTile({ label, value, hint, icon, tone = 'text-slate-600 bg-slate-100', to, children }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        {icon && (
          <span className={`rounded-md p-1.5 ${tone}`}>
            <Icon name={icon} className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="num mt-1 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      {children}
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </>
  );
  const cls = 'block rounded-xl border border-slate-200 bg-white p-4 shadow-sm';
  return to ? (
    <Link to={to} className={`${cls} transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Thin 0–100 % meter under the conformity rate. */
function Meter({ value }) {
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <div className="h-full rounded-full bg-green-600" style={{ width: `${value * 100}%` }} />
    </div>
  );
}

/** What needs this user's attention next: review queue for inspectors, own open work for technicians. */
function WorkQueue() {
  const { user } = useAuth();
  const reviewer = user.role !== ROLES.TECHNICIAN;
  const params = reviewer
    ? { status: SUBMITTED, current: 'true', sort: 'updated', dir: 'asc', pageSize: 6 }
    : { status: [REJECTED, IN_PROGRESS, DRAFT].join(','), createdBy: user.id, current: 'true', pageSize: 6 };
  const { data, error, loading } = useAsync(() => api.records.list(params), [user.id]);
  const items = (data?.items ?? [])
    .filter((r) => !reviewer || r.createdBy !== user.id)
    // Returned records first: they are blocking someone.
    .sort((a, b) => (b.status === REJECTED) - (a.status === REJECTED));

  return (
    <Card
      title={reviewer ? 'Review queue' : 'My open work'}
      description={reviewer ? 'Oldest submissions first' : 'Returned records first, then work in progress'}
      actions={
        <Link to={reviewer ? '/repository?status=SUBMITTED' : `/repository?createdBy=${user.id}`} className="btn-ghost text-xs">
          View all <Icon name="chevronRight" className="h-3.5 w-3.5" />
        </Link>
      }
    >
      {loading && !data && <Spinner />}
      <ErrorBanner error={error} />
      {data && !items.length && (
        <div className="flex flex-col items-center py-6 text-center">
          <span className="rounded-full bg-green-50 p-2 text-green-700">
            <Icon name="check" />
          </span>
          <p className="mt-2 text-sm font-medium text-slate-700">All caught up</p>
          <p className="text-xs text-slate-500">{reviewer ? 'Nothing is waiting for review.' : 'You have no open records.'}</p>
        </div>
      )}
      {items.length > 0 && (
        <ul className="-mx-5 -my-3 divide-y divide-slate-100">
          {items.map((r) => (
            <li key={r.id}>
              <Link to={`/records/${r.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="num text-sm font-medium text-brand-700">{r.referenceNo}</p>
                  <p className="truncate text-xs text-slate-500">
                    {[r.manufacturer?.name, r.model?.modelName].filter(Boolean).join(' · ') || 'Untitled instrument'}
                    {reviewer && r.createdByName && ` · by ${r.createdByName}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {reviewer ? <ComplianceBadge value={r.compliance} /> : <StatusBadge status={r.status} />}
                  <span className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Icon name="clock" className="h-3 w-3" />
                    {reviewer ? `waiting ${timeAgo(r.submittedAt)}` : `updated ${timeAgo(r.updatedAt, ' ago')}`}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function WeightAlerts({ alerts }) {
  if (!alerts?.length) return null;
  return (
    <div className="mb-6 flex flex-wrap items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <Icon name="alert" className="mt-0.5 h-5 w-5 text-amber-600" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Reference weight certificates need attention</p>
        <ul className="mt-1 space-y-0.5">
          {alerts.map((w) => (
            <li key={w.id}>
              {w.name} — {w.expired ? <strong>expired {fmtDate(w.dueDate)}</strong> : <>due {fmtDate(w.dueDate)}</>}
              {w.expired && <span className="text-amber-800"> · records using it cannot be submitted</span>}
            </li>
          ))}
        </ul>
      </div>
      <Link to="/weights" className="btn-secondary py-1.5 text-xs">Open register</Link>
    </div>
  );
}

function Workload({ rows }) {
  if (!rows.length) return <EmptyState title="No records yet" />;
  const max = Math.max(...rows.map((r) => r.total));
  const cols = [
    ['inProcess', 'In process'],
    ['submitted', 'Awaiting'],
    ['approved', 'Approved'],
    ['rejected', 'Returned'],
  ];
  return (
    <div className="-m-5 overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2.5">Technician</th>
            {cols.map(([k, l]) => <th key={k} className="px-4 py-2.5 text-right">{l}</th>)}
            <th className="w-1/4 px-4 py-2.5">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((w) => (
            <tr key={w.userId}>
              <td className="px-4 py-2.5">
                <Link to={`/repository?createdBy=${w.userId}`} className="font-medium text-brand-700 hover:underline">{w.name}</Link>
              </td>
              {cols.map(([k]) => (
                <td key={k} className="num px-4 py-2.5 text-right text-slate-700">{w[k]}</td>
              ))}
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(w.total / max) * 100}%` }} />
                  </div>
                  <span className="num w-6 text-right font-semibold">{w.total}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Shown until the laboratory has its first record: what each role needs to do first. */
function GettingStarted({ stats }) {
  const { user, can } = useAuth();
  const steps = [
    can('weights:manage') && {
      done: stats.setup.weightSets > 0,
      text: 'Register the calibrated reference weight sets',
      to: '/weights',
      cta: 'Reference weights',
    },
    can('users:manage') && {
      done: stats.setup.technicians > 0 && stats.setup.inspectors > 0,
      text: 'Add a technician and an inspector, and have them activate their accounts',
      to: '/users',
      cta: 'Users',
    },
    { done: user.hasSignature, text: 'Add your signature for reports', to: '/profile', cta: 'Profile' },
    can('record:create') && { done: false, text: 'Create the first test record', to: '/records/new', cta: 'New record' },
    !can('record:create') && { done: false, text: 'Wait for technicians to submit records for review', to: null },
  ].filter(Boolean);

  return (
    <Card title="Getting started" description="No test records yet. Work through these steps to bring the laboratory online.">
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s.text} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                s.done ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {s.done ? <Icon name="check" className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={`flex-1 ${s.done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{s.text}</span>
            {s.to && !s.done && (
              <Link to={s.to} className="btn-secondary py-1 text-xs">
                {s.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export function DashboardPage() {
  const { user } = useAuth();
  const stats = useAsync(() => api.records.stats(), []);
  const recent = useAsync(() => api.records.list({ pageSize: 6 }), []);
  const s = stats.data;
  const count = (t) => t.statuses.reduce((sum, st) => sum + (s.byStatus[st] ?? 0), 0);

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.name}`}
        subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' · laboratory overview'}
        actions={
          <Can permission="record:create">
            <Link to="/records/new" className="btn-primary">
              <Icon name="plus" className="h-4 w-4" /> New test record
            </Link>
          </Can>
        }
      />

      <ErrorBanner error={stats.error} />
      {stats.loading && !s && <Spinner />}
      {s && (
        <>
          <WeightAlerts alerts={s.weightAlerts} />
          {s.total === 0 && (
            <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
              <GettingStarted stats={s} />
              {user.role === ROLES.ADMIN && <SampleDataCard onChange={stats.reload} />}
            </div>
          )}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {TILES.map((t) => (
              <StatTile key={t.key} {...t} value={count(t)} to={`/repository?status=${t.statuses.join(',')}`} />
            ))}
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {s && (
            <Card
              title="Instruments tested per month"
              description="By test date, current revisions, split by outcome"
              actions={<Legend series={OUTCOME_SERIES} />}
            >
              <MonthlyChart months={s.monthly} />
            </Card>
          )}
          <Card
            title="Recent activity"
            description="Most recently updated test records"
            actions={<Link to="/repository" className="btn-ghost text-xs">View all <Icon name="chevronRight" className="h-3.5 w-3.5" /></Link>}
          >
            {recent.loading && !recent.data && <Spinner />}
            <ErrorBanner error={recent.error} />
            {recent.data &&
              (recent.data.items.length ? (
                <div className="-m-5">
                  <RecordsTable items={recent.data.items} compact />
                </div>
              ) : (
                <EmptyState title="No test records yet">Create a record to get started.</EmptyState>
              ))}
          </Card>
        </div>

        <div className="order-first space-y-6 xl:order-none">
          <WorkQueue />
          {s && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <StatTile
                  label="Conformity"
                  icon="shield"
                  tone="text-green-700 bg-green-50"
                  value={s.outcomes.passRate === null ? '—' : `${Math.round(s.outcomes.passRate * 100)}%`}
                  hint={`${s.outcomes.PASS} pass · ${s.outcomes.FAIL} fail`}
                  to="/repository?status=APPROVED"
                >
                  {s.outcomes.passRate !== null && <Meter value={s.outcomes.passRate} />}
                </StatTile>
                <StatTile
                  label="Review time"
                  icon="clock"
                  value={fmtHours(s.turnaround.averageHours)}
                  hint={`Average over ${s.turnaround.count} review${s.turnaround.count === 1 ? '' : 's'}`}
                />
              </div>
              <Card title="Record pipeline" description={`${s.total} records, all revisions`}>
                <PipelineBar
                  segments={TILES.map((t) => ({ key: t.key, label: t.label, value: count(t), color: t.color, to: `/repository?status=${t.statuses.join(',')}` }))}
                />
              </Card>
            </>
          )}
        </div>
      </div>

      {s && (
        <div className="mt-6">
          <Card title="Workload by technician">
            <Workload rows={s.workload} />
          </Card>
        </div>
      )}
    </>
  );
}

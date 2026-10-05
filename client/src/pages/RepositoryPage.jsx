import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ACCURACY_CLASSES, RECORD_STATUS, RECORD_STATUS_LABELS } from '@nawi/shared';
import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { Card } from '../components/ui/Card.jsx';
import { EmptyState, ErrorBanner, Spinner } from '../components/ui/Feedback.jsx';
import { Icon } from '../components/ui/Icon.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { RecordsTable } from '../features/record/RecordsTable.jsx';

const FILTERS = ['q', 'status', 'accuracyClass', 'compliance', 'manufacturer', 'from', 'to', 'createdBy', 'current', 'sort', 'dir', 'page'];
/** Keys that narrow the result set (sorting and paging don't). */
const NARROWING = ['q', 'status', 'accuracyClass', 'compliance', 'manufacturer', 'from', 'to', 'createdBy', 'current'];
const PAGE_SIZE = 20;
const COMPLIANCE_LABELS = { PASS: 'Pass', FAIL: 'Fail', PENDING: 'Pending' };

export function RepositoryPage() {
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(FILTERS.map((k) => [k, params.get(k) ?? '']));
  const page = Number(filters.page) || 1;
  const [query, setQuery] = useState(filters.q);
  const manufacturers = useAsync(() => api.records.manufacturers(), []);
  const toast = useToast();
  const [exporting, setExporting] = useState(false);

  function setFilter(key, value, { keepPage = false } = {}) {
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        value ? next.set(key, value) : next.delete(key);
        if (!keepPage) next.delete('page');
        return next;
      },
      { replace: true },
    );
  }

  // Debounce free-text search into the URL so results are shareable/bookmarkable.
  useEffect(() => {
    if (query === filters.q) return undefined;
    const t = setTimeout(() => setFilter('q', query), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const key = FILTERS.map((k) => filters[k]).join('|');
  const { data, error, loading } = useAsync(() => api.records.list({ ...filters, page, pageSize: PAGE_SIZE }), [key]);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const anyFilter = NARROWING.some((k) => filters[k]);
  const narrowing = Object.fromEntries(NARROWING.map((k) => [k, filters[k]]));

  const exportCsv = async () => {
    setExporting(true);
    try {
      await api.records.exportCsv({ ...narrowing, sort: filters.sort, dir: filters.dir });
      toast.success('Export ready', `${data?.total ?? ''} record${data?.total === 1 ? '' : 's'} saved as CSV.`);
    } catch (err) {
      toast.error('Export failed', err.message);
    } finally {
      setExporting(false);
    }
  };

  const sortBy = (sort, dir) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.set('sort', sort);
        next.set('dir', dir);
        next.delete('page');
        return next;
      },
      { replace: true },
    );

  const chipLabel = {
    q: (v) => `“${v}”`,
    status: (v) => v.split(',').map((x) => RECORD_STATUS_LABELS[x] ?? x).join(' + '),
    compliance: (v) => `Result: ${COMPLIANCE_LABELS[v] ?? v}`,
    manufacturer: (v) => v,
    accuracyClass: (v) => `Class ${v}`,
    from: (v) => `From ${v}`,
    to: (v) => `To ${v}`,
    createdBy: () => 'One technician',
    current: () => 'Current revisions only',
  };

  // A dashboard tile may link with several statuses (e.g. DRAFT,IN_PROGRESS); show those as one option.
  const statusOptions = Object.values(RECORD_STATUS).map((s) => ({ value: s, label: RECORD_STATUS_LABELS[s] }));
  if (filters.status && !statusOptions.some((o) => o.value === filters.status)) {
    statusOptions.unshift({ value: filters.status, label: filters.status.split(',').map((s) => RECORD_STATUS_LABELS[s]).join(' + ') });
  }

  return (
    <>
      <PageHeader
        title="Report repository"
        subtitle="Search, filter and retrieve test records and approved reports."
        actions={
          <button type="button" className="btn-secondary" onClick={exportCsv} disabled={exporting || !data?.total}>
            <Icon name="download" className="h-4 w-4" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        }
      />

      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              className="input pl-9"
              placeholder="Reference, manufacturer, model, serial…"
              aria-label="Search records"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select className="input" aria-label="Status" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">All statuses</option>
            {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="input" aria-label="Result" value={filters.compliance} onChange={(e) => setFilter('compliance', e.target.value)}>
            <option value="">Any result</option>
            {Object.keys(COMPLIANCE_LABELS).map((c) => <option key={c} value={c}>{COMPLIANCE_LABELS[c]}</option>)}
          </select>
          <select className="input" aria-label="Manufacturer" value={filters.manufacturer} onChange={(e) => setFilter('manufacturer', e.target.value)}>
            <option value="">All manufacturers</option>
            {manufacturers.data?.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="input" aria-label="Accuracy class" value={filters.accuracyClass} onChange={(e) => setFilter('accuracyClass', e.target.value)}>
            <option value="">All classes</option>
            {ACCURACY_CLASSES.map((c) => <option key={c} value={c}>Class {c}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="shrink-0">Tested from</span>
            <input type="date" className="input" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="shrink-0">to</span>
            <input type="date" className="input" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
          </label>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2 text-slate-600">
            <input type="checkbox" checked={filters.current === 'true'} onChange={(e) => setFilter('current', e.target.checked ? 'true' : '')} />
            Hide superseded revisions
          </label>
          {NARROWING.filter((k) => k !== 'current' && filters[k]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-200">
              {chipLabel[k](filters[k])}
              <button
                type="button"
                aria-label={`Remove filter ${chipLabel[k](filters[k])}`}
                className="rounded-full p-0.5 hover:bg-brand-100"
                onClick={() => {
                  if (k === 'q') setQuery('');
                  setFilter(k, '');
                }}
              >
                <Icon name="x" className="h-3 w-3" />
              </button>
            </span>
          ))}
          {anyFilter && (
            <button
              className="text-brand-700 hover:underline"
              onClick={() => {
                setQuery('');
                setParams({}, { replace: true });
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        <ErrorBanner error={error} />
        {loading && !data && <Spinner />}
        {data && (
          <>
            <p className="mb-2 text-xs text-slate-500">
              {data.total} record{data.total === 1 ? '' : 's'}
              {loading && ' · updating…'}
            </p>
            {data.items.length ? (
              <div className="-mx-5 border-t border-slate-200">
                <RecordsTable items={data.items} showDownload sort={filters.sort || 'updated'} dir={filters.dir || 'desc'} onSort={sortBy} />
              </div>
            ) : (
              <EmptyState title="No records match these filters">Try removing a filter or searching by serial number.</EmptyState>
            )}
            {pages > 1 && (
              <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
                <button className="btn-secondary" disabled={page <= 1} onClick={() => setFilter('page', String(page - 1), { keepPage: true })}>
                  ← Previous
                </button>
                <span className="text-slate-600">Page {page} of {pages}</span>
                <button className="btn-secondary" disabled={page >= pages} onClick={() => setFilter('page', String(page + 1), { keepPage: true })}>
                  Next →
                </button>
              </nav>
            )}
          </>
        )}
      </Card>
    </>
  );
}

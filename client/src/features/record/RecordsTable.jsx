import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RECORD_STATUS } from '@nawi/shared';
import { api } from '../../api/client.js';
import { ComplianceBadge, StatusBadge, Tag } from '../../components/ui/StatusBadge.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { fmtDate, fmtDateTime, timeAgo } from '../../lib/format.js';

function DownloadButton({ record }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      className="rounded px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
      disabled={busy}
      title={failed ? 'Download failed — try again' : 'Download the approved PDF report'}
      onClick={async () => {
        setBusy(true);
        setFailed(false);
        try {
          await api.records.downloadReport(record, 'pdf');
        } catch {
          setFailed(true);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? '…' : failed ? 'Retry PDF' : 'PDF ↓'}
    </button>
  );
}

/** Column header that toggles server-side sorting when `onSort` is given. */
function Th({ children, sortKey, sort, dir, onSort, className = '' }) {
  if (!onSort || !sortKey) return <th className={`px-4 py-2.5 ${className}`}>{children}</th>;
  const active = sort === sortKey;
  return (
    <th className={`px-4 py-2.5 ${className}`} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <button
        type="button"
        onClick={() => onSort(sortKey, active && dir === 'desc' ? 'asc' : 'desc')}
        className={`group inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-900 ${active ? 'text-slate-900' : ''}`}
      >
        {children}
        <Icon
          name={active ? (dir === 'asc' ? 'arrowUp' : 'arrowDown') : 'sort'}
          className={`h-3.5 w-3.5 ${active ? '' : 'opacity-0 group-hover:opacity-60'}`}
        />
      </button>
    </th>
  );
}

export function RecordsTable({ items, showDownload = false, compact = false, sort, dir, onSort }) {
  const th = { sort, dir, onSort };
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            <Th sortKey="reference" {...th}>Reference</Th>
            <Th sortKey="manufacturer" {...th}>Manufacturer / model</Th>
            {!compact && <Th>Serial no.</Th>}
            {!compact && <Th>Class</Th>}
            <Th>Max / e</Th>
            {!compact && <Th sortKey="testDate" {...th}>Test date</Th>}
            <Th sortKey="status" {...th}>Status</Th>
            <Th sortKey="result" {...th}>Result</Th>
            <Th sortKey="updated" {...th}>Updated</Th>
            {showDownload && <th className="px-4 py-2.5"><span className="sr-only">Report</span></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {items.map((r) => (
            <tr key={r.id} className={`hover:bg-slate-50 ${r.supersededBy ? 'text-slate-500' : ''}`}>
              <td className="whitespace-nowrap px-4 py-3">
                <Link to={`/records/${r.id}`} className="num font-medium text-brand-700 hover:underline">
                  {r.referenceNo}
                </Link>
                {(r.supersededBy || r.sample) && (
                  <div className="mt-0.5 flex gap-1">
                    {r.sample && <Tag tone="blue">Sample</Tag>}
                    {r.supersededBy && <Tag tone="amber">Superseded</Tag>}
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-slate-900">{r.manufacturer?.name || '—'}</div>
                <div className="text-xs text-slate-500">
                  {r.model?.modelName || '—'}
                  {compact && r.model?.serialNumber && <span className="num"> · {r.model.serialNumber}</span>}
                </div>
              </td>
              {!compact && <td className="num whitespace-nowrap px-4 py-3">{r.model?.serialNumber || '—'}</td>}
              {!compact && <td className="px-4 py-3">{r.instrument?.accuracyClass || '—'}</td>}
              <td className="num whitespace-nowrap px-4 py-3">
                {r.instrument?.maxCapacity ? `${r.instrument.maxCapacity} ${r.instrument.unit}` : '—'}
                {r.instrument?.e && <span className="text-slate-500"> / {r.instrument.e}</span>}
              </td>
              {!compact && <td className="num whitespace-nowrap px-4 py-3">{r.environment?.testDate || '—'}</td>}
              <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
              <td className="px-4 py-3"><ComplianceBadge value={r.compliance} /></td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500" title={fmtDateTime(r.updatedAt)}>
                {compact ? timeAgo(r.updatedAt, ' ago') : fmtDate(r.updatedAt)}
              </td>
              {showDownload && (
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {r.status === RECORD_STATUS.APPROVED && <DownloadButton record={r} />}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

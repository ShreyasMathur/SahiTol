import { useParams } from 'react-router-dom';
import { ACCURACY_CLASS_LABELS, RECORD_STATUS } from '@nawi/shared';
import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { ErrorBanner, Spinner } from '../components/ui/Feedback.jsx';
import { ComplianceBadge } from '../components/ui/StatusBadge.jsx';
import { fmtDateTime } from '../lib/format.js';

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="col-span-2 font-medium text-slate-900">{children || '—'}</dd>
    </div>
  );
}

/** Public page reached from the QR code on a report. */
export function VerifyPage() {
  const { id } = useParams();
  const { data: v, error, loading } = useAsync(() => api.public.verify(id), [id]);
  const approved = v?.status === RECORD_STATUS.APPROVED;

  let banner = null;
  if (v && !approved) banner = { cls: 'border-amber-300 bg-amber-50 text-amber-900', text: 'This report has not been approved and is not valid.' };
  else if (v?.intact === false) banner = { cls: 'border-red-300 bg-red-50 text-red-900', text: '✕ The stored record no longer matches its approved fingerprint. Do not rely on this report.' };
  else if (v?.supersededBy) banner = { cls: 'border-amber-300 bg-amber-50 text-amber-900', text: `Authentic, but superseded by revision ${v.supersededBy}.` };
  else if (v) banner = { cls: 'border-green-300 bg-green-50 text-green-900', text: '✓ Authentic — this report was issued and approved by the laboratory and has not been altered.' };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Legal Metrology · Report verification</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{v?.referenceNo ?? 'Test report'}</h1>

        <div className="mt-6 space-y-4">
          {loading && <Spinner label="Checking report…" />}
          {error && <ErrorBanner error={error.status === 404 ? new Error('No report exists with this identifier.') : error} />}
          {banner && <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${banner.cls}`}>{banner.text}</div>}

          {v && (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <dl className="divide-y divide-slate-100">
                <Row label="Result">{v.compliance && <ComplianceBadge value={v.compliance} />}</Row>
                <Row label="Manufacturer">{v.manufacturer}</Row>
                <Row label="Model / serial">{[v.model, v.serialNumber].filter(Boolean).join(' / ')}</Row>
                <Row label="Accuracy class">{ACCURACY_CLASS_LABELS[v.accuracyClass]}</Row>
                <Row label="Test date">{v.testDate}</Row>
                <Row label="Approved">{approved && `${fmtDateTime(v.approvedAt)} by ${v.approvedBy}`}</Row>
                <Row label="Revision">{String(v.revision)}</Row>
                <Row label="Record fingerprint">
                  <span className="num break-all text-xs">{v.recordHash}</span>
                </Row>
                <Row label="PDF SHA-256">
                  <span className="num break-all text-xs">{v.pdfSha256}</span>
                </Row>
              </dl>
              <p className="mt-3 text-xs text-slate-500">
                Compare the record fingerprint with the one printed at the foot of every page of the report. To check a PDF file, compute its
                SHA-256 (e.g. <span className="num">certutil -hashfile report.pdf SHA256</span>) and compare it with the value above.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

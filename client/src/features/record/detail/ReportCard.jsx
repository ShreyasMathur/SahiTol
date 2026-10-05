import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RECORD_STATUS } from '@nawi/shared';
import { api } from '../../../api/client.js';
import { Card } from '../../../components/ui/Card.jsx';
import { ErrorBanner } from '../../../components/ui/Feedback.jsx';

export function ReportCard({ record }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const approved = record.status === RECORD_STATUS.APPROVED;

  const download = async (format) => {
    setBusy(format);
    setError(null);
    try {
      await api.records.downloadReport(record, format);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card title="Test report">
      <div className="space-y-3">
        <ErrorBanner error={error} />
        <button className="btn-primary w-full" disabled={Boolean(busy)} onClick={() => download('pdf')}>
          {busy === 'pdf' ? 'Preparing…' : approved ? 'Download report (PDF)' : 'Preview draft (PDF)'}
        </button>
        <button className="btn-secondary w-full" disabled={Boolean(busy)} onClick={() => download('docx')}>
          {busy === 'docx' ? 'Preparing…' : 'Export to Word (.docx)'}
        </button>
        {approved ? (
          <dl className="space-y-2 text-xs">
            <div>
              <dt className="text-slate-500">Record fingerprint (SHA-256)</dt>
              <dd className="num break-all">{record.recordHash}</dd>
            </div>
            {record.report && (
              <div>
                <dt className="text-slate-500">PDF file SHA-256</dt>
                <dd className="num break-all">{record.report.pdfSha256}</dd>
              </div>
            )}
            <dd>
              <Link to={`/verify/${record.id}`} className="text-brand-700 hover:underline" target="_blank">
                Public verification page ↗
              </Link>
            </dd>
          </dl>
        ) : (
          <p className="text-xs text-slate-500">Drafts are watermarked. The final PDF is generated, fingerprinted and stored on approval.</p>
        )}
      </div>
    </Card>
  );
}

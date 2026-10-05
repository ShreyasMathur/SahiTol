import { RECORD_STATUS_LABELS } from '@nawi/shared';

const STATUS_STYLES = {
  DRAFT: 'bg-slate-100 text-slate-700 ring-slate-300',
  IN_PROGRESS: 'bg-blue-50 text-blue-800 ring-blue-200',
  SUBMITTED: 'bg-amber-50 text-amber-800 ring-amber-200',
  APPROVED: 'bg-green-50 text-green-800 ring-green-200',
  REJECTED: 'bg-red-50 text-red-800 ring-red-200',
};

const COMPLIANCE_STYLES = {
  PASS: { cls: 'bg-green-50 text-green-800 ring-green-200', icon: '✓', label: 'Pass' },
  FAIL: { cls: 'bg-red-50 text-red-800 ring-red-200', icon: '✕', label: 'Fail' },
  PENDING: { cls: 'bg-slate-100 text-slate-700 ring-slate-300', icon: '…', label: 'Pending' },
  NA: { cls: 'bg-slate-50 text-slate-500 ring-slate-200', icon: '–', label: 'N/A' },
};

const base = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap';

export function StatusBadge({ status }) {
  return <span className={`${base} ${STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT}`}>{RECORD_STATUS_LABELS[status] ?? status}</span>;
}

export function ComplianceBadge({ value }) {
  const s = COMPLIANCE_STYLES[value] ?? COMPLIANCE_STYLES.PENDING;
  return (
    <span className={`${base} ${s.cls}`}>
      <span aria-hidden>{s.icon}</span>
      {s.label}
    </span>
  );
}

/** Pass/fail for a single row or check; renders nothing when undecided. */
export function PassFail({ pass }) {
  if (pass === true) return <span className="font-medium text-green-700">✓ Pass</span>;
  if (pass === false) return <span className="font-medium text-red-700">✕ Fail</span>;
  return <span className="text-slate-400">—</span>;
}

export function Tag({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-300',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    red: 'bg-red-50 text-red-800 ring-red-200',
    green: 'bg-green-50 text-green-800 ring-green-200',
    blue: 'bg-blue-50 text-blue-800 ring-blue-200',
  };
  return <span className={`${base} ${tones[tone]}`}>{children}</span>;
}

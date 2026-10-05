import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { availableActions, RECORD_STATUS, ROLES, can } from '@nawi/shared';
import { api } from '../../../api/client.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { ErrorBanner } from '../../../components/ui/Feedback.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';

function ServerIssues({ error }) {
  const issues = error?.details?.issues;
  if (!issues?.length) return <ErrorBanner error={error} />;
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <p className="font-medium">{error.message}</p>
      <ul className="mt-1 list-inside list-disc">{issues.map((i) => <li key={i}>{i}</li>)}</ul>
    </div>
  );
}

export function WorkflowCard({ record, onDone }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const isOwner = user.role === ROLES.ADMIN || record.createdBy === user.id;
  const actions = record.supersededBy
    ? []
    : availableActions(user.role, record.status).filter((a) => (a.key === 'submit' ? isOwner : record.createdBy !== user.id));
  const reviewBlockedOwnRecord = record.status === RECORD_STATUS.SUBMITTED && can(user.role, 'record:review') && record.createdBy === user.id;
  const canRevise = record.status === RECORD_STATUS.APPROVED && !record.supersededBy && can(user.role, 'record:revise');

  if (!actions.length && !canRevise && !reviewBlockedOwnRecord) return null;

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const transition = (key) =>
    run(async () => {
      await api.records.transition(record.id, key, comment);
      setComment('');
      toast.success(
        { submit: 'Submitted for approval', approve: 'Record approved', reject: 'Record returned to technician' }[key],
        {
          submit: 'The record is locked and signed. An inspector will review it.',
          approve: 'The final PDF has been generated and fingerprinted.',
          reject: 'The technician can correct and resubmit it.',
        }[key],
      );
      onDone();
    });

  const revise = () =>
    run(async () => {
      const created = await api.records.revise(record.id, reason);
      toast.success(`Revision ${created.referenceNo} opened`, `${record.referenceNo} is now marked superseded.`);
      navigate(`/records/${created.id}`);
    });

  const isReview = actions.some((a) => a.key === 'approve');
  const submit = actions.find((a) => a.key === 'submit');

  return (
    <Card title={isReview ? 'Inspector review' : canRevise ? 'Corrections' : 'Submission'}>
      <div className="space-y-3">
        <ServerIssues error={error} />

        {reviewBlockedOwnRecord && <p className="text-sm text-slate-600">You created this record, so another inspector must review it.</p>}

        {submit && (
          <>
            {record.readiness.ready ? (
              <p className="text-sm text-green-800">✓ All sections, tests and reference weights are complete.</p>
            ) : (
              <div className="text-sm text-amber-900">
                <p className="font-medium">Before submitting:</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {record.readiness.issues.slice(0, 8).map((i) => <li key={i}>{i}</li>)}
                  {record.readiness.issues.length > 8 && <li>…and {record.readiness.issues.length - 8} more</li>}
                </ul>
              </div>
            )}
            <p className="text-xs text-slate-500">Submitting signs the record electronically as {user.name} and locks it for review.</p>
            <button className="btn-primary w-full" disabled={busy || !record.readiness.ready} onClick={() => transition('submit')}>
              {submit.label}
            </button>
          </>
        )}

        {isReview && (
          <>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Remarks (required to reject)</span>
              <textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
            </label>
            <p className="text-xs text-slate-500">Approving signs as {user.name}, generates the final PDF and locks the record.</p>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" disabled={busy} onClick={() => transition('approve')}>
                {busy ? 'Working…' : 'Approve'}
              </button>
              <button className="btn-danger flex-1" disabled={busy || !comment.trim()} onClick={() => transition('reject')}>
                Reject
              </button>
            </div>
          </>
        )}

        {canRevise && (
          <>
            <p className="text-sm text-slate-600">
              Approved records are locked. To correct one, open a revision — this record stays on file, marked as superseded.
            </p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Reason for revision</span>
              <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <button className="btn-secondary w-full" disabled={busy || !reason.trim()} onClick={revise}>
              Create revision
            </button>
          </>
        )}
      </div>
    </Card>
  );
}

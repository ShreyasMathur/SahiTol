import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { fmtDateTime, ROLE_LABELS } from '../../../lib/format.js';

function Signature({ heading, sig }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{heading}</p>
      {sig ? (
        <>
          <div className="my-1 flex h-14 items-center">
            {sig.image ? <img src={sig.image} alt={`Signature of ${sig.name}`} className="max-h-14" /> : <span className="text-xs italic text-slate-400">No signature image</span>}
          </div>
          <p className="text-sm font-medium text-slate-900">{sig.name}</p>
          <p className="text-xs text-slate-500">
            {ROLE_LABELS[sig.role] ?? sig.role} · signed {fmtDateTime(sig.signedAt)}
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-slate-400">Not signed</p>
      )}
    </div>
  );
}

export function SignaturesCard({ record }) {
  const { user } = useAuth();
  return (
    <Card title="Signatures">
      <div className="space-y-3">
        <Signature heading="Tested by" sig={record.signatures?.technician} />
        <Signature heading="Approved by" sig={record.signatures?.inspector} />
        {!user.hasSignature && (
          <p className="text-xs text-slate-500">
            Your signature image appears on reports you sign. <Link to="/profile" className="text-brand-700 hover:underline">Add one in your profile</Link>.
          </p>
        )}
      </div>
    </Card>
  );
}

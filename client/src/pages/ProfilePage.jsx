import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { Card } from '../components/ui/Card.jsx';
import { ErrorBanner, Spinner } from '../components/ui/Feedback.jsx';
import { TextField } from '../components/ui/FormField.jsx';
import { SignaturePad } from '../features/profile/SignaturePad.jsx';
import { resizeImage } from '../lib/images.js';
import { ROLE_LABELS, fmtDateTime, timeAgo } from '../lib/format.js';
import { Icon } from '../components/ui/Icon.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { NewPasswordFields, passwordReady } from '../components/ui/PasswordFields.jsx';

function PasswordCard() {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const ready = form.current && passwordReady(form.next, form.confirm, user);

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await api.auth.changePassword(form.current, form.next);
      setForm({ current: '', next: '', confirm: '' });
      toast.success('Password changed', 'You have been signed out on your other devices.');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Change password" description={user.passwordChangedAt ? `Last changed ${fmtDateTime(user.passwordChangedAt)}` : undefined}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <ErrorBanner error={error} />
        <TextField label="Current password" type="password" autoComplete="current-password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
        <NewPasswordFields
          value={form.next}
          confirm={form.confirm}
          onChange={(v) => setForm({ ...form, next: v })}
          onConfirmChange={(v) => setForm({ ...form, confirm: v })}
          username={user.username}
          name={user.name}
        />
        <button className="btn-primary" disabled={!ready || busy}>{busy ? 'Changing…' : 'Change password'}</button>
      </form>
    </Card>
  );
}

/** Rough "Edge on Windows"-style label from a user-agent string. */
function deviceLabel(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}

function SessionsCard() {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => api.auth.sessions(), []);
  const others = data?.filter((s) => !s.current).length ?? 0;

  const run = async (fn, message) => {
    try {
      await fn();
      toast.success(message);
      reload();
    } catch (err) {
      toast.error('Could not sign out', err.message);
    }
  };

  return (
    <Card
      title="Where you are signed in"
      description="Sessions end after a period of inactivity. Sign out any you don't recognise."
      actions={
        others > 0 && (
          <button className="btn-secondary text-xs" onClick={() => run(api.auth.revokeOtherSessions, 'Signed out of other sessions')}>
            Sign out all others
          </button>
        )
      }
    >
      {loading && !data && <Spinner />}
      <ErrorBanner error={error} />
      <ul className="-my-2 divide-y divide-slate-100">
        {data?.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
            <span className="rounded-md bg-slate-100 p-1.5 text-slate-500">
              <Icon name="user" className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">
                {deviceLabel(s.userAgent ?? '')}
                {s.current && <span className="ml-2 text-xs font-normal text-green-700">This device</span>}
              </p>
              <p className="text-xs text-slate-500">
                Signed in {fmtDateTime(s.createdAt)} · active {timeAgo(s.lastSeenAt, ' ago')}
                {s.ip && <span className="num"> · {s.ip}</span>}
              </p>
            </div>
            {!s.current && (
              <button className="btn-ghost px-2 py-1 text-xs" onClick={() => run(() => api.auth.revokeSession(s.id), 'Session signed out')}>
                Sign out
              </button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SignatureCard() {
  const { user, setUser } = useAuth();
  const current = useAsync(() => api.auth.getSignature(), []);
  const [draft, setDraft] = useState(null);
  const [padKey, setPadKey] = useState(0);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async (dataUrl) => {
    setBusy(true);
    setError(null);
    try {
      setUser(await api.auth.setSignature(dataUrl));
      setDraft(null);
      setPadKey((k) => k + 1);
      current.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file) => {
    if (!file) return;
    try {
      setDraft(await resizeImage(file, { maxWidth: 600, maxHeight: 200, type: 'image/png' }));
    } catch (err) {
      setError(err);
    }
  };

  return (
    <Card title="Signature" description="Applied to test reports you submit or approve, alongside your name and the time of signing.">
      <div className="space-y-4">
        <ErrorBanner error={error} />
        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">On file</p>
          <div className="flex h-20 items-center rounded-md border border-slate-200 bg-slate-50 px-3">
            {current.data?.dataUrl ? <img src={current.data.dataUrl} alt={`Signature of ${user.name}`} className="max-h-16" /> : <span className="text-sm text-slate-400">No signature yet</span>}
          </div>
        </div>
        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">Draw a new signature</p>
          <SignaturePad key={padKey} onChange={setDraft} />
        </div>
        <label className="btn-secondary cursor-pointer">
          Or upload an image…
          <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
        </label>
        {draft && (
          <div className="rounded-md border border-slate-200 p-3">
            <p className="mb-1 text-xs text-slate-500">Preview</p>
            <img src={draft} alt="New signature preview" className="max-h-16" />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={!draft || busy} onClick={() => save(draft)}>Save signature</button>
          {current.data?.dataUrl && (
            <button className="btn-secondary" disabled={busy} onClick={() => save(null)}>Remove signature</button>
          )}
        </div>
      </div>
    </Card>
  );
}

export function ProfilePage() {
  const { user } = useAuth();
  const location = useLocation();
  return (
    <>
      <PageHeader
        title="Your profile"
        subtitle={[user.name, ROLE_LABELS[user.role], user.lab, `signed in as ${user.username}`].filter(Boolean).join(' · ')}
      />
      {location.state?.welcome && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-950">
          <p className="font-medium">Your account is active.</p>
          <p className="mt-0.5">
            Before you {user.role === 'inspector' ? 'approve' : 'submit'} your first record, draw or upload your signature below — it is printed on
            every report you sign.
          </p>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <SignatureCard />
        <div className="space-y-6">
          <PasswordCard />
          <SessionsCard />
        </div>
      </div>
    </>
  );
}

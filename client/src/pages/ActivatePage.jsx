import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorBanner, Spinner } from '../components/ui/Feedback.jsx';
import { Icon } from '../components/ui/Icon.jsx';
import { NewPasswordFields, passwordReady } from '../components/ui/PasswordFields.jsx';
import { AuthCard, AuthShell } from '../components/layout/AuthShell.jsx';
import { fmtDateTime } from '../lib/format.js';

/** One-time link from the administrator: activate a new account, or reset a forgotten password. */
export function ActivatePage() {
  const { token } = useParams();
  const { signedIn, user } = useAuth();
  const navigate = useNavigate();
  const link = useAsync(() => api.auth.linkInfo(token), [token]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (link.loading) {
    return (
      <AuthShell>
        <Spinner label="Checking your link…" />
      </AuthShell>
    );
  }

  if (link.error) {
    return (
      <AuthShell>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <span className="inline-flex rounded-full bg-amber-50 p-2 text-amber-700">
            <Icon name="alert" />
          </span>
          <h2 className="mt-3 text-lg font-semibold text-slate-900">This link can&rsquo;t be used</h2>
          <p className="mt-1 text-sm text-slate-600">{link.error.message}</p>
          <Link to="/login" className="btn-secondary mt-6">Go to sign in</Link>
        </div>
      </AuthShell>
    );
  }

  const info = link.data;
  const activating = info.purpose === 'activate';
  const context = { username: info.username, name: info.name };

  const submit = async (e) => {
    e.preventDefault();
    if (!passwordReady(password, confirm, context)) return;
    setBusy(true);
    setError(null);
    try {
      signedIn(await api.auth.redeemLink(token, password));
      navigate(activating ? '/profile' : '/', { replace: true, state: { welcome: activating } });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <AuthCard
        eyebrow={activating ? 'Activate your account' : 'Reset your password'}
        title={activating ? `Welcome, ${info.name}` : `Choose a new password`}
        subtitle={
          activating
            ? `Your username is ${info.username}. Choose a password to finish setting up your account.`
            : `For ${info.username}. Signing in with the new password signs you out everywhere else.`
        }
        onSubmit={submit}
      >
        {user && user.username !== info.username && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            You are signed in as {user.username}. Continuing will switch to {info.username}.
          </p>
        )}
        <ErrorBanner error={error} />
        <NewPasswordFields value={password} confirm={confirm} onChange={setPassword} onConfirmChange={setConfirm} {...context} />
        <button type="submit" className="btn-primary w-full py-2.5" disabled={busy || !passwordReady(password, confirm, context)}>
          {busy ? 'Saving…' : activating ? 'Activate account and sign in' : 'Set password and sign in'}
        </button>
        <p className="text-center text-xs text-slate-500">This link works once and expires {fmtDateTime(info.expiresAt)}.</p>
      </AuthCard>
    </AuthShell>
  );
}

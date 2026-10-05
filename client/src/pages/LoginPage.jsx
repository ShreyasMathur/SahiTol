import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorBanner } from '../components/ui/Feedback.jsx';
import { TextField } from '../components/ui/FormField.jsx';
import { AuthCard, AuthShell } from '../components/layout/AuthShell.jsx';

export function LoginPage() {
  const { user, login, sessionExpired, setupRequired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const from = location.state?.from?.pathname ?? '/';

  if (setupRequired) return <Navigate to="/setup" replace />;
  if (user) return <Navigate to={from} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err);
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <AuthCard title="Sign in" subtitle="Use the account your laboratory administrator created for you." onSubmit={submit}>
        {sessionExpired && !error && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">Your session has ended. Please sign in again.</p>
        )}
        <ErrorBanner error={error} />
        <TextField label="Username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
        <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="btn-primary w-full py-2.5" disabled={busy || !username || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="text-center text-sm">
          <button type="button" className="text-brand-700 hover:underline" onClick={() => setShowHelp((s) => !s)} aria-expanded={showHelp}>
            Forgot your password or don&rsquo;t have an account?
          </button>
          {showHelp && (
            <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-left text-slate-600">
              Accounts are created by your laboratory administrator, who will give you a one-time link to set your password. If you
              have forgotten your password or your account is locked, ask the administrator for a new link.
            </p>
          )}
        </div>
      </AuthCard>
    </AuthShell>
  );
}

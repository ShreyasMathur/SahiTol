import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { USERNAME_PATTERN } from '@nawi/shared';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorBanner } from '../components/ui/Feedback.jsx';
import { TextField } from '../components/ui/FormField.jsx';
import { NewPasswordFields, passwordReady } from '../components/ui/PasswordFields.jsx';
import { AuthCard, AuthShell } from '../components/layout/AuthShell.jsx';

/** First run: create the laboratory's first administrator using the code from the server console. */
export function SetupPage() {
  const { setupRequired, user, signedIn } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ setupCode: '', name: '', username: '', lab: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;
  if (!setupRequired) return <Navigate to="/login" replace />;

  const bind = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });
  const usernameError = f.username && !USERNAME_PATTERN.test(f.username) ? '3–32 letters, digits, dots, dashes or underscores' : undefined;
  const ready =
    f.setupCode.trim() && f.name.trim() && f.username && !usernameError && passwordReady(f.password, f.confirm, { username: f.username, name: f.name });

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const { confirm: _, ...fields } = f;
      signedIn(await api.auth.setup(fields));
      navigate('/users', { replace: true, state: { welcome: true } });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <AuthCard
        eyebrow="First-run setup"
        title="Create the administrator account"
        subtitle="No accounts exist yet. The administrator adds everyone else and manages the reference-weight register."
        onSubmit={submit}
      >
        <ErrorBanner error={error} />
        <TextField
          label="Setup code"
          required
          autoFocus
          autoComplete="off"
          className="[&_input]:font-mono [&_input]:uppercase"
          hint="Printed in the server console when the server starts (e.g. ABCD-1234)."
          {...bind('setupCode')}
        />
        <TextField label="Full name" required autoComplete="name" {...bind('name')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Username" required autoComplete="username" error={usernameError} {...bind('username')} />
          <TextField label="Email" type="email" autoComplete="email" {...bind('email')} />
        </div>
        <TextField label="Laboratory / office" hint="Shown on your profile and reports" {...bind('lab')} />
        <NewPasswordFields
          label="Password"
          value={f.password}
          confirm={f.confirm}
          onChange={(v) => setF({ ...f, password: v })}
          onConfirmChange={(v) => setF({ ...f, confirm: v })}
          username={f.username}
          name={f.name}
        />
        <button type="submit" className="btn-primary w-full py-2.5" disabled={busy || !ready}>
          {busy ? 'Creating…' : 'Create administrator and sign in'}
        </button>
      </AuthCard>
    </AuthShell>
  );
}

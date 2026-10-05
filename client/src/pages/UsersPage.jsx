import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ROLES, USERNAME_PATTERN } from '@nawi/shared';
import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { Card } from '../components/ui/Card.jsx';
import { EmptyState, ErrorBanner, Spinner } from '../components/ui/Feedback.jsx';
import { SelectField, TextField } from '../components/ui/FormField.jsx';
import { Icon } from '../components/ui/Icon.jsx';
import { Tag } from '../components/ui/StatusBadge.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { ROLE_LABELS, fmtDateTime, timeAgo } from '../lib/format.js';

const ROLE_OPTIONS = Object.values(ROLES).map((r) => ({ value: r, label: ROLE_LABELS[r] }));
const ROLE_HINTS = {
  technician: 'Creates records, enters test readings and submits them for approval.',
  inspector: 'Reviews submitted records and approves or returns them.',
  admin: 'Manages accounts and the reference-weight register; can also do everything above.',
};

const STATUS = {
  active: <Tag tone="green">Active</Tag>,
  pending: <Tag tone="blue">Awaiting activation</Tag>,
  locked: <Tag tone="red">Locked</Tag>,
  disabled: <Tag>Disabled</Tag>,
};

function UserForm({ initial, onCancel, onSaved }) {
  const isNew = !initial.id;
  const [u, setU] = useState(initial);
  const [shown, setShown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const f = (field) => ({ value: u[field] ?? '', onChange: (e) => setU({ ...u, [field]: e.target.value }) });
  const errors = {
    username: isNew && !USERNAME_PATTERN.test(u.username ?? '') ? '3–32 letters, digits, dots, dashes or underscores' : undefined,
    name: !u.name?.trim() ? 'Full name is required' : undefined,
  };
  const valid = !Object.values(errors).some(Boolean);

  const save = async (e) => {
    e.preventDefault();
    setShown(true);
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const fields = { name: u.name, role: u.role, lab: u.lab, email: u.email };
      onSaved(isNew ? await api.users.create({ ...fields, username: u.username }) : { user: await api.users.update(u.id, { ...fields, active: u.active }) });
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title={isNew ? 'Add a user' : `Edit ${initial.username}`}
      description={isNew ? 'No password is set here. You will get a one-time link for the person to choose their own.' : undefined}
    >
      <form onSubmit={save} className="space-y-4" noValidate>
        <ErrorBanner error={error} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField label="Full name" required autoComplete="off" error={shown ? errors.name : undefined} {...f('name')} />
          <TextField
            label="Username"
            required
            disabled={!isNew}
            autoComplete="off"
            hint={isNew ? 'Used to sign in; cannot be changed later' : undefined}
            error={shown ? errors.username : undefined}
            {...f('username')}
          />
          <SelectField label="Role" required options={ROLE_OPTIONS} hint={ROLE_HINTS[u.role]} {...f('role')} />
          <TextField label="Laboratory / office" {...f('lab')} />
          <TextField label="Email" type="email" autoComplete="off" {...f('email')} />
          {!isNew && (
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
              <input type="checkbox" checked={u.active} onChange={(e) => setU({ ...u, active: e.target.checked })} />
              Account enabled
            </label>
          )}
        </div>
        {!isNew && initial.active && !u.active && (
          <p className="text-sm text-amber-800">Disabling signs this person out immediately. Their records and signatures stay on file.</p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : isNew ? 'Create user' : 'Save'}</button>
        </div>
      </form>
    </Card>
  );
}

/** Shows a freshly issued one-time link once, with a copy button. */
function LinkPanel({ link, user, onClose }) {
  const [copied, setCopied] = useState(false);
  const activate = link.purpose === 'activate';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-full bg-white p-1.5 text-brand-700 ring-1 ring-brand-200">
          <Icon name={activate ? 'user' : 'shield'} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900">
            {activate ? `Activation link for ${user.name}` : `Password reset link for ${user.name}`}
          </p>
          <p className="mt-0.5 text-sm text-slate-600">
            Give this link to <strong>{user.username}</strong> in person or by official email. It works once and expires in {link.expiresInHours} hours.
            It is shown only now — issue a new one if it is lost.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input readOnly value={link.url} onFocus={(e) => e.target.select()} className="input num min-w-0 flex-1 bg-white text-xs" aria-label="One-time link" />
            <button type="button" className="btn-primary" onClick={copy}>
              <Icon name={copied ? 'check' : 'copy'} className="h-4 w-4" /> {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Dismiss">
          <Icon name="x" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

const EVENT_LABELS = {
  'account:setup': 'Laboratory set up',
  'account:created': 'Account created',
  'account:updated': 'Account changed',
  'account:activated': 'Account activated',
  'account:reset-link': 'Password reset link issued',
  'account:password-reset': 'Password reset',
  'account:password-changed': 'Password changed',
  'account:locked': 'Account locked',
  'account:unlocked': 'Account unlocked',
  'auth:signed-in': 'Signed in',
  'auth:sign-in-failed': 'Failed sign-in',
  'auth:signed-out-others': 'Signed out other sessions',
  'samples:weights-loaded': 'Sample weight sets added',
  'samples:records-loaded': 'Sample records added',
  'samples:removed': 'Sample data removed',
};
const ALERT_EVENTS = new Set(['account:locked', 'auth:sign-in-failed']);

function SecurityLog() {
  const { data, error, loading } = useAsync(() => api.users.securityLog(), []);
  return (
    <Card title="Security log" description="Sign-ins, failed attempts and account changes, newest first.">
      {loading && !data && <Spinner />}
      <ErrorBanner error={error} />
      {data && !data.length && <EmptyState title="No events yet" />}
      <ol className="-my-2 max-h-96 divide-y divide-slate-100 overflow-y-auto">
        {data?.map((e) => (
          <li key={e.id} className="flex items-start gap-3 py-2 text-sm">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ALERT_EVENTS.has(e.action) ? 'bg-red-500' : 'bg-slate-300'}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p>
                <span className="font-medium text-slate-900">{EVENT_LABELS[e.action] ?? e.action}</span>
                {e.userName !== 'system' && <span className="text-slate-500"> · {e.userName}</span>}
              </p>
              {e.comment && <p className="truncate text-xs text-slate-500" title={e.comment}>{e.comment}</p>}
            </div>
            <time className="shrink-0 text-xs text-slate-400" title={fmtDateTime(e.at)}>{timeAgo(e.at, ' ago')}</time>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Welcome() {
  return (
    <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-950">
      <p className="font-medium">Your laboratory is set up. Suggested next steps:</p>
      <ol className="mt-2 list-inside list-decimal space-y-1">
        <li>
          Register your calibrated standard weights in <Link to="/weights" className="font-medium underline">Reference weights</Link> — records cannot be
          submitted without in-date weights.
        </li>
        <li>Add your inspectors and technicians below and give each their activation link.</li>
        <li>
          Draw your signature in <Link to="/profile" className="font-medium underline">your profile</Link> so it appears on reports you approve.
        </li>
      </ol>
    </div>
  );
}

export function UsersPage() {
  const { user: me } = useAuth();
  const location = useLocation();
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => api.users.list(), []);
  const [editing, setEditing] = useState(null);
  const [issued, setIssued] = useState(null);
  const [busy, setBusy] = useState(null);

  const act = async (u, key, fn, done) => {
    setBusy(`${u.id}:${key}`);
    try {
      await done(await fn());
      reload();
    } catch (err) {
      toast.error('Action failed', err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Accounts, roles and access. People set their own passwords through one-time links you issue."
        actions={
          !editing && (
            <button className="btn-primary" onClick={() => setEditing({ username: '', name: '', role: ROLES.TECHNICIAN, lab: me.lab ?? '', email: '' })}>
              <Icon name="plus" className="h-4 w-4" /> Add user
            </button>
          )
        }
      />
      {location.state?.welcome && <Welcome />}
      {issued && <LinkPanel {...issued} onClose={() => setIssued(null)} />}
      {editing && (
        <div className="mb-6">
          <UserForm
            key={editing.id ?? 'new'}
            initial={editing}
            onCancel={() => setEditing(null)}
            onSaved={({ user, link }) => {
              setEditing(null);
              if (link) setIssued({ user, link });
              toast.success(link ? `${user.name} added` : 'User updated', link ? 'Copy the activation link and give it to them.' : undefined);
              reload();
            }}
          />
        </div>
      )}

      <div className="space-y-6">
        <Card>
          <ErrorBanner error={error} />
          {loading && !data && <Spinner />}
          {data && (
            <div className="-m-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="whitespace-nowrap bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">User</th>
                    <th className="px-4 py-2.5">Role</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Last sign-in</th>
                    <th className="px-4 py-2.5">Signature</th>
                    <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((u) => (
                    <tr key={u.id} className={u.active ? '' : 'text-slate-400'}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {u.name}
                          {u.id === me.id && <span className="ml-1 text-xs font-normal text-slate-500">(you)</span>}
                        </p>
                        <p className="text-xs text-slate-500">
                          <span className="num">{u.username}</span>
                          {u.lab && ` · ${u.lab}`}
                        </p>
                      </td>
                      <td className="px-4 py-3">{ROLE_LABELS[u.role]}</td>
                      <td className="px-4 py-3">{STATUS[u.status]}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500" title={fmtDateTime(u.lastLoginAt)}>
                        {u.lastLoginAt ? timeAgo(u.lastLoginAt, ' ago') : 'Never'}
                      </td>
                      <td className="px-4 py-3">{u.hasSignature ? <span className="text-green-700">✓ On file</span> : <span className="text-slate-400">—</span>}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {u.status === 'locked' && (
                            <button
                              className="btn-ghost px-2 py-1 text-xs"
                              disabled={busy === `${u.id}:unlock`}
                              onClick={() => act(u, 'unlock', () => api.users.unlock(u.id), () => toast.success(`${u.username} unlocked`))}
                            >
                              Unlock
                            </button>
                          )}
                          {u.active && u.id !== me.id && (
                            <button
                              className="btn-ghost px-2 py-1 text-xs"
                              disabled={busy === `${u.id}:link`}
                              onClick={() => act(u, 'link', () => api.users.issueLink(u.id), (link) => setIssued({ user: u, link }))}
                            >
                              {u.status === 'pending' ? 'New activation link' : 'Reset password'}
                            </button>
                          )}
                          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(u)}>Edit</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <SecurityLog key={data ? data.length : 0} />
      </div>
    </>
  );
}

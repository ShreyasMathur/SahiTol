import { passwordChecks } from '@nawi/shared';
import { TextField } from './FormField.jsx';
import { Icon } from './Icon.jsx';

/** New password + confirmation with a live checklist of the shared password policy. */
export function NewPasswordFields({ value, confirm, onChange, onConfirmChange, username, name, label = 'New password' }) {
  const checks = passwordChecks(value, { username, name }).filter((c) => c.id !== 'max' || !c.ok);
  const mismatch = confirm && value !== confirm;
  return (
    <>
      <TextField label={label} type="password" autoComplete="new-password" required value={value} onChange={(e) => onChange(e.target.value)} />
      <ul className="-mt-2 grid gap-1 text-xs" aria-label="Password requirements">
        {checks.map((c) => {
          const ok = c.ok && value.length > 0;
          return (
            <li key={c.id} className={`flex items-center gap-1.5 ${ok ? 'text-green-700' : 'text-slate-500'}`}>
              <Icon name={ok ? 'check' : 'info'} className="h-3.5 w-3.5" />
              {c.text}
            </li>
          );
        })}
      </ul>
      <TextField
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        required
        value={confirm}
        error={mismatch ? 'Passwords do not match' : undefined}
        onChange={(e) => onConfirmChange(e.target.value)}
      />
    </>
  );
}

export const passwordReady = (value, confirm, context) => value === confirm && passwordChecks(value, context).every((c) => c.ok);

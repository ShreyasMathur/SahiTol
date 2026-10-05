import { useId } from 'react';

/**
 * Label + control + message. `error` wins over `warning`; both are announced
 * through aria-describedby so the message isn't colour-only.
 */
export function FormField({ label, hint, error, warning, required, children, className = '' }) {
  const id = useId();
  const msgId = `${id}-msg`;
  const message = error ?? warning ?? hint;
  const messageClass = error ? 'text-red-700' : warning ? 'text-amber-700' : 'text-slate-500';

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-600" aria-hidden>*</span>}
      </label>
      {children({ id, 'aria-describedby': message ? msgId : undefined, 'aria-invalid': Boolean(error) })}
      {message && (
        <p id={msgId} className={`mt-1 text-xs ${messageClass}`}>
          {error ? '✕ ' : warning ? '⚠ ' : ''}
          {message}
        </p>
      )}
    </div>
  );
}

export function TextField({ label, hint, error, warning, required, className, unit, ...inputProps }) {
  return (
    <FormField {...{ label, hint, error, warning, required, className }}>
      {(a11y) => (
        <div className="relative">
          <input {...a11y} {...inputProps} className={`input ${unit ? 'pr-12' : ''} ${error ? 'input-error' : ''}`} />
          {unit && (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">
              {unit}
            </span>
          )}
        </div>
      )}
    </FormField>
  );
}

export function SelectField({ label, hint, error, warning, required, className, options, placeholder, ...selectProps }) {
  return (
    <FormField {...{ label, hint, error, warning, required, className }}>
      {(a11y) => (
        <select {...a11y} {...selectProps} className={`input ${error ? 'input-error' : ''}`}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FormField>
  );
}

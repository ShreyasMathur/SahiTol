import { ERROR_METHODS } from '@nawi/shared';
import { PassFail } from '../../components/ui/StatusBadge.jsx';

export const th = 'px-2 py-2 text-left text-xs font-medium text-slate-500 whitespace-nowrap';
export const td = 'px-2 py-1.5 align-middle';

export function NumInput({ value, onChange, readOnly, label, invalid, className = 'w-28' }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={value ?? ''}
      disabled={readOnly}
      onChange={(e) => onChange(e.target.value)}
      className={`input num py-1 text-right ${invalid ? 'input-error' : ''} ${className}`}
    />
  );
}

export const Value = ({ v, muted }) => <span className={`num ${muted ? 'text-slate-500' : ''}`}>{v ?? '—'}</span>;

export { PassFail };

export const isChangepoint = (obs) => (obs.method ?? ERROR_METHODS.CHANGEPOINT) === ERROR_METHODS.CHANGEPOINT;

export function MethodToggle({ form, readOnly }) {
  const { obs, set, spec } = form;
  const method = obs.method ?? ERROR_METHODS.CHANGEPOINT;
  const dLessThanE = spec.d && Number(spec.d) < Number(spec.e);
  const options = [
    { value: ERROR_METHODS.CHANGEPOINT, label: 'Changepoint (ΔL)', hint: 'E = I + ½d − ΔL − L' },
    { value: ERROR_METHODS.DIRECT, label: 'Direct reading', hint: 'E = I − L' },
  ];
  return (
    <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      <legend className="sr-only">Error determination method</legend>
      <span className="font-medium text-slate-700">Method</span>
      {options.map((o) => (
        <label key={o.value} className="flex items-center gap-2">
          <input type="radio" name="method" value={o.value} checked={method === o.value} disabled={readOnly} onChange={() => set(['method'], o.value)} />
          <span>
            {o.label} <span className="num text-xs text-slate-500">{o.hint}</span>
          </span>
        </label>
      ))}
      {method === ERROR_METHODS.DIRECT && !dLessThanE && (
        <span className="text-xs text-amber-700">⚠ Direct reading is only appropriate when d is finer than e.</span>
      )}
    </fieldset>
  );
}

/** E0 reading at or near zero, used to correct errors (R 76-1 A.4.4.3). */
export function ZeroReading({ form, readOnly, withLoad = true, label = 'Zero reading (E0)' }) {
  const { obs, set, rowByKey, spec } = form;
  const row = rowByKey.zero;
  const cp = isChangepoint(obs);
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md bg-slate-50 p-3">
      <p className="w-full text-sm font-medium text-slate-700">
        {label} <span className="font-normal text-slate-500">— at or near zero, e.g. 10e</span>
      </p>
      {withLoad && (
        <label className="text-xs text-slate-600">
          Load ({spec.unit})
          <NumInput label="Zero load" value={obs.zero?.load} readOnly={readOnly} onChange={(v) => set(['zero', 'load'], v)} />
        </label>
      )}
      <label className="text-xs text-slate-600">
        I ({spec.unit})
        <NumInput label="Zero indication" value={obs.zero?.indication} readOnly={readOnly} invalid={Boolean(row?.invalid)} onChange={(v) => set(['zero', 'indication'], v)} />
      </label>
      {cp && (
        <label className="text-xs text-slate-600">
          ΔL ({spec.unit})
          <NumInput label="Zero ΔL" value={obs.zero?.additionalLoad} readOnly={readOnly} invalid={Boolean(row?.invalid)} onChange={(v) => set(['zero', 'additionalLoad'], v)} />
        </label>
      )}
      <p className="pb-1.5 text-sm">
        E0 = <Value v={row?.error} /> {row?.error && spec.unit}
      </p>
    </div>
  );
}

export function IssuesPanel({ result }) {
  if (!result.issues.length && !result.warnings.length) return null;
  return (
    <div className="space-y-2">
      {result.issues.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="mb-1 font-medium">To complete this test</p>
          <ul className="list-inside list-disc space-y-0.5">
            {result.issues.map((i) => <li key={i}>{i}</li>)}
          </ul>
        </div>
      )}
      {result.warnings.length > 0 && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <ul className="space-y-0.5">
            {result.warnings.map((w) => <li key={w}>⚠ {w}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export function RemoveButton({ onClick, readOnly, label }) {
  if (readOnly) return null;
  return (
    <button type="button" onClick={onClick} aria-label={label} className="rounded px-2 py-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
      ✕
    </button>
  );
}

export const TableWrap = ({ children }) => (
  <div className="overflow-x-auto rounded-md border border-slate-200">
    <table className="min-w-full divide-y divide-slate-200 text-sm">{children}</table>
  </div>
);

import { NumInput, PassFail, Value } from '../components.jsx';

export function ZeroSettingForm({ form, readOnly }) {
  const { obs, set, rowByKey, spec } = form;
  const row = rowByKey.zeroSetting;
  const d = spec.d || spec.e;
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Zero the instrument, then add small weights in steps of 0.1d until the indication changes from zero to{' '}
        <span className="num">{d}</span> {spec.unit}. Record the total added load ΔL. The zero error is E0 = ½d − ΔL and must be within ±0.25e.
      </p>
      <div className="flex flex-wrap items-end gap-6">
        <label className="text-sm text-slate-700">
          ΔL ({spec.unit})
          <NumInput label="ΔL" value={obs.additionalLoad} readOnly={readOnly} invalid={Boolean(row?.invalid)} onChange={(v) => set(['additionalLoad'], v)} />
        </label>
        <dl className="flex gap-6 pb-1 text-sm">
          <div>
            <dt className="text-xs text-slate-500">E0</dt>
            <dd><Value v={row?.error} /></dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Limit</dt>
            <dd className="num">±{form.result.summary.limit ?? (Number(spec.e) * 0.25).toString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Result</dt>
            <dd><PassFail pass={row?.pass} /></dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

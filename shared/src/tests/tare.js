import { TEST_TYPES, ERROR_METHODS, TARE_DEVICES } from '../constants.js';
import { Dec, isBlank } from '../math.js';
import { checkPlausible, isFilled, methodOf, mpeAt, parseLoad, parseReading, str, zeroCorrection } from './common.js';
import { suggestTestLoads } from './loads.js';
import { finalize, notApplicable, pending } from './result.js';

/**
 * Weighing test with tare — OIML R 76-1 3.5.3.3 / A.4.6.
 *
 * With a tare load in place and the tare function operated, net loads are
 * applied. The MPE applies to the net load: |Ec| ≤ MPE(net load).
 *
 * Observations:
 *   { method, tareLoad, zero: { indication, additionalLoad },   // net zero after taring
 *     points: [{ netLoad, indication, additionalLoad }] }
 */
export const tare = {
  type: TEST_TYPES.TARE,
  label: 'Tare',
  reference: 'OIML R 76-1 3.5.3.3, A.4.6',

  applies: (spec) => !isBlank(spec.tareDevice) && spec.tareDevice !== TARE_DEVICES.NONE,

  defaults: (spec) => {
    const s = suggestTestLoads(spec).tare;
    const tareLoad = isBlank(spec.maxTare) ? s.tareLoad : Dec.min(new Dec(s.tareLoad), new Dec(spec.maxTare)).toString();
    return {
      method: ERROR_METHODS.CHANGEPOINT,
      tareLoad,
      zero: { indication: '', additionalLoad: '' },
      points: s.netLoads.map((netLoad) => ({ netLoad, indication: '', additionalLoad: '' })),
    };
  },

  evaluate(obs = {}, spec) {
    if (!tare.applies(spec)) return notApplicable('Instrument has no tare device');
    const points = obs.points ?? [];
    if (!points.some(isFilled)) return pending('No observations recorded');

    const method = methodOf(obs);
    const issues = [];
    const warnings = [];
    const rows = [];
    const checks = [];

    const T = parseLoad(obs.tareLoad, spec, 'Tare load', { max: isBlank(spec.maxTare) ? spec.maxCapacity : spec.maxTare });
    if (T.error) {
      issues.push(T.error);
      return finalize({ rows, issues, warnings, checks });
    }
    const netMax = new Dec(spec.maxCapacity).minus(T.value);

    const { E0, row: zeroRow } = zeroCorrection(obs.zero, spec, method, issues, warnings);
    if (zeroRow) rows.push(zeroRow);

    points.forEach((p, i) => {
      if (!isFilled(p)) return;
      const key = `${i}`;
      const label = `Net load ${i + 1}`;
      const L = parseLoad(p.netLoad, spec, label, { max: netMax });
      const r = L.error ? L : parseReading(p, L.value, spec, method, label);
      if (r.error) {
        issues.push(r.error);
        rows.push({ key, invalid: r.error });
        return;
      }
      const mpe = mpeAt(spec, L.value);
      const Ec = r.E.minus(E0);
      const pass = Ec.abs().lte(mpe);
      checkPlausible(Ec, mpe, label, warnings);
      rows.push({
        key,
        netLoad: str(L.value),
        indication: str(r.I),
        additionalLoad: str(r.dL),
        error: str(r.E),
        correctedError: str(Ec),
        mpe: str(mpe),
        pass,
      });
      checks.push(pass);
    });

    return finalize({ rows, issues, warnings, checks, summary: { tareLoad: str(T.value), E0: str(E0) } });
  },
};

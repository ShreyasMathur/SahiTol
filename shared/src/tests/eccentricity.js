import { TEST_TYPES, ERROR_METHODS } from '../constants.js';
import { Dec } from '../math.js';
import { checkPlausible, isFilled, methodOf, mpeAt, parseLoad, parseReading, str, zeroCorrection } from './common.js';
import { suggestTestLoads } from './loads.js';
import { finalize, pending } from './result.js';

/** Load receptor positions for a receptor with up to 4 points of support. */
export const ECCENTRICITY_POSITIONS = [
  { id: 'C', label: 'Centre' },
  { id: '1', label: 'Position 1' },
  { id: '2', label: 'Position 2' },
  { id: '3', label: 'Position 3' },
  { id: '4', label: 'Position 4' },
];

/**
 * Eccentricity — OIML R 76-1 3.6.2 / A.4.7.
 *
 * The same load (about 1/3 of Max) is placed at the centre and in each
 * quarter of the receptor. |Ec| at every position must not exceed the MPE for
 * that load.
 *
 * Observations: { method, load, zero, positions: { C: reading, 1: reading, … } }
 */
export const eccentricity = {
  type: TEST_TYPES.ECCENTRICITY,
  label: 'Eccentricity',
  reference: 'OIML R 76-1 3.6.2, A.4.7',

  defaults: (spec) => {
    const s = suggestTestLoads(spec);
    return {
      method: ERROR_METHODS.CHANGEPOINT,
      load: s.eccentricity,
      zero: { load: s.zeroLoad, indication: '', additionalLoad: '' },
      positions: Object.fromEntries(ECCENTRICITY_POSITIONS.map((p) => [p.id, { indication: '', additionalLoad: '' }])),
    };
  },

  evaluate(obs = {}, spec) {
    const positions = obs.positions ?? {};
    if (!ECCENTRICITY_POSITIONS.some((p) => isFilled(positions[p.id]))) return pending('No observations recorded');

    const method = methodOf(obs);
    const issues = [];
    const warnings = [];
    const rows = [];
    const checks = [];

    const L = parseLoad(obs.load, spec, 'Test load');
    if (L.error) {
      issues.push(L.error);
      return finalize({ rows, issues, warnings, checks });
    }
    const max = new Dec(spec.maxCapacity);
    if (L.value.lt(max.mul('0.25')) || L.value.gt(max.mul('0.4'))) {
      warnings.push('R 76 specifies a test load of about 1/3 of Max');
    }

    const { E0, row: zeroRow } = zeroCorrection(obs.zero, spec, method, issues, warnings);
    if (zeroRow) rows.push(zeroRow);
    const mpe = mpeAt(spec, L.value);

    for (const pos of ECCENTRICITY_POSITIONS) {
      const reading = positions[pos.id];
      if (!isFilled(reading)) {
        issues.push(`${pos.label}: reading missing`);
        continue;
      }
      const r = parseReading(reading, L.value, spec, method, pos.label);
      if (r.error) {
        issues.push(r.error);
        rows.push({ key: pos.id, invalid: r.error });
        continue;
      }
      const Ec = r.E.minus(E0);
      const pass = Ec.abs().lte(mpe);
      checkPlausible(Ec, mpe, pos.label, warnings);
      rows.push({
        key: pos.id,
        position: pos.label,
        load: str(L.value),
        indication: str(r.I),
        additionalLoad: str(r.dL),
        error: str(r.E),
        correctedError: str(Ec),
        mpe: str(mpe),
        pass,
      });
      checks.push(pass);
    }

    return finalize({ rows, issues, warnings, checks, summary: { load: str(L.value), mpe: str(mpe), E0: str(E0) } });
  },
};

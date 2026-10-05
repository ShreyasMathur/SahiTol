import { TEST_TYPES } from '../constants.js';
import { isBlank, toDec } from '../math.js';
import { displayStep, parseLoad, str } from './common.js';
import { suggestTestLoads } from './loads.js';
import { finalize, pending } from './result.js';

const REQUIRED_POINTS = 3;

/**
 * Discrimination (digital indication) — OIML R 76-1 3.8 / A.4.8.
 *
 * At Min, ½ Max and Max, an extra load of 1.4d placed on the instrument at
 * equilibrium must increase the indication by at least d.
 *
 * Observations: { points: [{ load, indicationBefore, indicationAfter }] }
 */
export const discrimination = {
  type: TEST_TYPES.DISCRIMINATION,
  label: 'Discrimination',
  reference: 'OIML R 76-1 3.8, A.4.8',

  defaults: (spec) => ({
    points: suggestTestLoads(spec).discrimination.map((load) => ({ load, indicationBefore: '', indicationAfter: '' })),
  }),

  evaluate(obs = {}, spec) {
    const points = (obs.points ?? []).filter((p) => !isBlank(p.indicationBefore) || !isBlank(p.indicationAfter));
    if (!points.length) return pending('No observations recorded');

    const issues = [];
    const rows = [];
    const checks = [];
    const d = displayStep(spec);
    const extraLoad = d.mul('1.4');

    (obs.points ?? []).forEach((p, i) => {
      if (isBlank(p.indicationBefore) && isBlank(p.indicationAfter)) return;
      const label = `Load ${i + 1}`;
      const L = parseLoad(p.load, spec, label);
      const before = toDec(p.indicationBefore);
      const after = toDec(p.indicationAfter);
      const error = L.error ?? (before === null || after === null ? `${label}: enter both indications` : null);
      if (error) {
        issues.push(error);
        rows.push({ key: `${i}`, invalid: error });
        return;
      }
      const change = after.minus(before);
      const pass = change.gte(d);
      rows.push({
        key: `${i}`,
        load: str(L.value),
        indicationBefore: str(before),
        indicationAfter: str(after),
        change: str(change),
        required: str(d),
        pass,
      });
      checks.push(pass);
    });

    if (rows.filter((r) => !r.invalid).length < REQUIRED_POINTS) {
      issues.push(`Test at ${REQUIRED_POINTS} loads: Min, ½ Max and Max`);
    }
    return finalize({ rows, issues, checks, summary: { extraLoad: str(extraLoad) } });
  },
};

import { TEST_TYPES, ERROR_METHODS } from '../constants.js';
import { Dec } from '../math.js';
import { checkPlausible, isFilled, methodOf, mpeAt, parseLoad, parseReading, str, zeroCorrection } from './common.js';
import { suggestTestLoads } from './loads.js';
import { finalize, pending } from './result.js';

const DIRECTIONS = { up: 'increasing', down: 'decreasing' };
const MIN_LOADS = 5;

/**
 * Weighing performance — OIML R 76-1 A.4.4.
 *
 * Loads are applied increasing to Max and then decreasing. Each error is
 * corrected for the zero error, Ec = E − E0, and |Ec| must not exceed the MPE
 * at that load. At least 5 loads including Min and Max are required.
 *
 * Observations:
 *   { method, zero: { load, indication, additionalLoad },
 *     points: [{ load, up: { indication, additionalLoad }, down: { indication, additionalLoad } }] }
 */
export const weighingPerformance = {
  type: TEST_TYPES.WEIGHING,
  label: 'Weighing Performance',
  reference: 'OIML R 76-1 A.4.4',

  defaults: (spec) => {
    const s = suggestTestLoads(spec);
    return {
      method: ERROR_METHODS.CHANGEPOINT,
      zero: { load: s.zeroLoad, indication: '', additionalLoad: '' },
      points: s.weighing.map((load) => ({ load, up: { indication: '', additionalLoad: '' }, down: { indication: '', additionalLoad: '' } })),
    };
  },

  evaluate(obs = {}, spec) {
    const points = obs.points ?? [];
    if (!points.some((p) => isFilled(p.up) || isFilled(p.down))) return pending('No observations recorded');

    const method = methodOf(obs);
    const issues = [];
    const warnings = [];
    const rows = [];
    const checks = [];
    const { E0, row: zeroRow } = zeroCorrection(obs.zero, spec, method, issues, warnings);
    if (zeroRow) rows.push(zeroRow);

    const loads = [];
    points.forEach((p, i) => {
      const label = `Load ${i + 1}`;
      const L = parseLoad(p.load, spec, label);
      if (L.error) {
        issues.push(L.error);
        rows.push({ key: `${i}`, invalid: L.error });
        return;
      }
      loads.push(L.value);
      const mpe = mpeAt(spec, L.value);

      for (const [dir, dirLabel] of Object.entries(DIRECTIONS)) {
        const key = `${i}-${dir}`;
        if (!isFilled(p[dir])) {
          issues.push(`${label} (${L.value} ${spec.unit}): ${dirLabel} reading missing`);
          continue;
        }
        const r = parseReading(p[dir], L.value, spec, method, `${label} ${dirLabel}`);
        if (r.error) {
          issues.push(r.error);
          rows.push({ key, invalid: r.error });
          continue;
        }
        const Ec = r.E.minus(E0);
        const pass = Ec.abs().lte(mpe);
        checkPlausible(Ec, mpe, `${label} ${dirLabel}`, warnings);
        rows.push({
          key,
          load: str(L.value),
          direction: dir,
          indication: str(r.I),
          additionalLoad: str(r.dL),
          error: str(r.E),
          correctedError: str(Ec),
          mpe: str(mpe),
          pass,
        });
        checks.push(pass);
      }
    });

    const distinct = new Set(loads.map(String));
    if (distinct.size < MIN_LOADS) issues.push(`At least ${MIN_LOADS} different loads are required (R 76-1 A.4.4.1)`);
    if (!loads.some((L) => L.lte(new Dec(spec.minCapacity)))) issues.push('Include a load at Min');
    if (!loads.some((L) => L.eq(new Dec(spec.maxCapacity)))) issues.push('Include a load at Max');

    return finalize({ rows, issues, warnings, checks, summary: { E0: str(E0) } });
  },
};

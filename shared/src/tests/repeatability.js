import { TEST_TYPES, ERROR_METHODS } from '../constants.js';
import { Dec } from '../math.js';
import { checkPlausible, isFilled, methodOf, mpeAt, parseLoad, parseReading, str } from './common.js';
import { suggestTestLoads } from './loads.js';
import { finalize, pending } from './result.js';

const MIN_READINGS = 3;
const blankReadings = (n) => Array.from({ length: n }, () => ({ indication: '', additionalLoad: '' }));

/**
 * Repeatability — OIML R 76-1 3.6.1 / A.4.10.
 *
 * Two series of weighings, at about 50 % of Max and near Max. In each series
 * the spread of errors (max E − min E) must not exceed |MPE| for that load,
 * and every individual error must be within the MPE.
 *
 * Observations: { method, series: [{ load, readings: [{ indication, additionalLoad }] }] }
 */
export const repeatability = {
  type: TEST_TYPES.REPEATABILITY,
  label: 'Repeatability',
  reference: 'OIML R 76-1 3.6.1, A.4.10',

  defaults: (spec) => ({
    method: ERROR_METHODS.CHANGEPOINT,
    series: suggestTestLoads(spec).repeatability.map((load) => ({ load, readings: blankReadings(MIN_READINGS) })),
  }),

  evaluate(obs = {}, spec) {
    const series = obs.series ?? [];
    if (!series.some((s) => s.readings?.some(isFilled))) return pending('No observations recorded');

    const method = methodOf(obs);
    const issues = [];
    const warnings = [];
    const rows = [];
    const checks = [];
    const seriesSummary = [];

    series.forEach((s, si) => {
      const label = `Series ${si + 1}`;
      const L = parseLoad(s.load, spec, label);
      if (L.error) {
        issues.push(L.error);
        return;
      }
      const mpe = mpeAt(spec, L.value);
      const errors = [];

      (s.readings ?? []).forEach((reading, ri) => {
        if (!isFilled(reading)) return;
        const key = `${si}-${ri}`;
        const r = parseReading(reading, L.value, spec, method, `${label} reading ${ri + 1}`);
        if (r.error) {
          issues.push(r.error);
          rows.push({ key, invalid: r.error });
          return;
        }
        const pass = r.E.abs().lte(mpe);
        checkPlausible(r.E, mpe, `${label} reading ${ri + 1}`, warnings);
        errors.push(r.E);
        rows.push({
          key,
          series: si + 1,
          reading: ri + 1,
          load: str(L.value),
          indication: str(r.I),
          additionalLoad: str(r.dL),
          error: str(r.E),
          mpe: str(mpe),
          pass,
        });
        checks.push(pass);
      });

      if (errors.length < MIN_READINGS) {
        issues.push(`${label}: at least ${MIN_READINGS} weighings are required`);
      }
      if (errors.length) {
        const spread = Dec.max(...errors).minus(Dec.min(...errors));
        const pass = spread.lte(mpe);
        if (errors.length >= MIN_READINGS) checks.push(pass);
        seriesSummary.push({ key: si, load: str(L.value), count: errors.length, spread: str(spread), mpe: str(mpe), pass });
      }
    });

    if (series.length < 2) issues.push('Two series are required: about 50 % of Max and near Max');

    return finalize({ rows, issues, warnings, checks, summary: { series: seriesSummary } });
  },
};

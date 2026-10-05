import { Dec, isBlank, toDec } from './math.js';
import { UNIT_FACTORS, TEST_TYPES } from './constants.js';
import { mpeAt } from './tests/common.js';
import { validateInstrumentSpec } from './validation.js';

export const WEIGHT_CLASSES = ['E1', 'E2', 'F1', 'F2', 'M1', 'M2', 'M3'];

/**
 * Maximum permissible errors of standard weights, OIML R 111-1:2004 Table 1.
 * Nominal value in grams → MPE in mg for [E1, E2, F1, F2, M1, M2, M3]; null
 * where the class has no weight of that nominal value.
 */
const R111_TABLE = [
  ['5000000', [null, null, '25000', '80000', '250000', '800000', '2500000']],
  ['2000000', [null, null, '10000', '30000', '100000', '300000', '1000000']],
  ['1000000', [null, '1600', '5000', '16000', '50000', '160000', '500000']],
  ['500000', [null, '800', '2500', '8000', '25000', '80000', '250000']],
  ['200000', [null, '300', '1000', '3000', '10000', '30000', '100000']],
  ['100000', [null, '160', '500', '1600', '5000', '16000', '50000']],
  ['50000', ['25', '80', '250', '800', '2500', '8000', '25000']],
  ['20000', ['10', '30', '100', '300', '1000', '3000', '10000']],
  ['10000', ['5', '16', '50', '160', '500', '1600', '5000']],
  ['5000', ['2.5', '8', '25', '80', '250', '800', '2500']],
  ['2000', ['1', '3', '10', '30', '100', '300', '1000']],
  ['1000', ['0.5', '1.6', '5', '16', '50', '160', '500']],
  ['500', ['0.25', '0.8', '2.5', '8', '25', '80', '250']],
  ['200', ['0.1', '0.3', '1', '3', '10', '30', '100']],
  ['100', ['0.05', '0.16', '0.5', '1.6', '5', '16', '50']],
  ['50', ['0.03', '0.1', '0.3', '1', '3', '10', '30']],
  ['20', ['0.025', '0.08', '0.25', '0.8', '2.5', '8', '25']],
  ['10', ['0.02', '0.06', '0.2', '0.6', '2', '6', '20']],
  ['5', ['0.016', '0.05', '0.16', '0.5', '1.6', '5', '16']],
  ['2', ['0.012', '0.04', '0.12', '0.4', '1.2', '4', '12']],
  ['1', ['0.01', '0.03', '0.1', '0.3', '1', '3', '10']],
  ['0.5', ['0.008', '0.025', '0.08', '0.25', '0.8', '2.5', null]],
  ['0.2', ['0.006', '0.02', '0.06', '0.2', '0.6', '2', null]],
  ['0.1', ['0.005', '0.016', '0.05', '0.16', '0.5', '1.6', null]],
  ['0.05', ['0.004', '0.012', '0.04', '0.12', '0.4', null, null]],
  ['0.02', ['0.003', '0.01', '0.03', '0.1', '0.3', null, null]],
  ['0.01', ['0.003', '0.008', '0.025', '0.08', '0.25', null, null]],
  ['0.005', ['0.003', '0.006', '0.02', '0.06', '0.2', null, null]],
  ['0.002', ['0.003', '0.006', '0.02', '0.06', '0.2', null, null]],
  ['0.001', ['0.003', '0.006', '0.02', '0.06', '0.2', null, null]],
];

/** Nominal values (grams, as strings), largest first. */
export const WEIGHT_NOMINALS = R111_TABLE.map(([g]) => g);

/** Human-readable mass for a value in grams, e.g. "500 mg", "20 kg", "2 t". */
export function formatMass(grams) {
  const g = new Dec(grams);
  if (g.gte(1000000)) return `${g.div(1000000)} t`;
  if (g.gte(1000)) return `${g.div(1000)} kg`;
  if (g.lt(1)) return `${g.mul(1000)} mg`;
  return `${g} g`;
}

/** MPE of one standard weight, in grams, or null if the class has no such weight. */
export function weightPieceMPE(nominalGrams, weightClass) {
  const row = R111_TABLE.find(([g]) => new Dec(g).eq(nominalGrams));
  const col = WEIGHT_CLASSES.indexOf(weightClass);
  const mg = row?.[1][col];
  return mg ? new Dec(mg).div(1000) : null;
}

const classRank = (c) => WEIGHT_CLASSES.indexOf(c);

/**
 * Makes up a load (grams) from standard pieces, largest first. Each piece
 * comes from the most accurate selected set whose nominal range contains it.
 * MPEs of the pieces are summed linearly, which is conservative.
 */
export function composeLoad(loadGrams, sets) {
  const ordered = [...sets].sort((a, b) => classRank(a.class) - classRank(b.class));
  let rest = new Dec(loadGrams);
  let mpe = new Dec(0);
  const pieces = [];

  for (const nominal of WEIGHT_NOMINALS) {
    const n = new Dec(nominal);
    if (n.gt(rest)) continue;
    const set = ordered.find(
      (s) => n.gte(s.minNominal) && n.lte(s.maxNominal) && weightPieceMPE(nominal, s.class) !== null,
    );
    if (!set) continue;
    const count = rest.div(n).floor();
    const pieceMpe = weightPieceMPE(nominal, set.class).mul(count);
    pieces.push({ nominal, count: count.toNumber(), setId: set.id, class: set.class, mpe: pieceMpe.toString() });
    mpe = mpe.plus(pieceMpe);
    rest = rest.minus(n.mul(count));
  }
  // Anything left below 1 mg is negligible for NAWI testing.
  return { pieces, mpe, covered: rest.lt('0.001') };
}

/** Standard loads applied in each test (the tare load itself need not be a standard). */
export function collectStandardLoads(record) {
  const t = record.tests ?? {};
  const loads = [
    ...(t[TEST_TYPES.WEIGHING]?.points ?? []).map((p) => p.load),
    t[TEST_TYPES.ECCENTRICITY]?.load,
    ...(t[TEST_TYPES.REPEATABILITY]?.series ?? []).map((s) => s.load),
    ...(t[TEST_TYPES.DISCRIMINATION]?.points ?? []).map((p) => p.load),
    ...(t[TEST_TYPES.TARE]?.points ?? []).map((p) => p.netLoad),
  ];
  const unique = new Map();
  for (const l of loads) {
    const d = toDec(l);
    if (d && d.gt(0)) unique.set(d.toString(), d);
  }
  return [...unique.values()].sort((a, b) => a.comparedTo(b));
}

const DAY = 24 * 60 * 60 * 1000;
const DUE_SOON_DAYS = 30;

/**
 * Checks the reference weights selected for a record:
 * - calibration certificates valid on the test date
 * - every standard load can be made up from the selected sets
 * - weight MPE ≤ 1/3 of the instrument MPE at that load (R 76-1 3.7.1)
 */
export function checkReferenceWeights(record, weightSets) {
  const issues = [];
  const warnings = [];
  const loads = [];
  const selected = (record.referenceWeights ?? []).map((id) => weightSets.find((w) => w.id === id)).filter(Boolean);

  if (!selected.length) {
    issues.push('Select the reference weight set(s) used for testing');
    return { valid: false, issues, warnings, loads, selected };
  }

  const testDate = isBlank(record.environment?.testDate) ? new Date() : new Date(record.environment.testDate);
  for (const set of selected) {
    const due = new Date(set.dueDate);
    if (due < testDate) issues.push(`${set.name}: calibration expired on ${set.dueDate}`);
    else if (due - testDate < DUE_SOON_DAYS * DAY) warnings.push(`${set.name}: calibration due on ${set.dueDate}`);
  }

  const spec = record.instrument ?? {};
  if (!validateInstrumentSpec(spec).valid) return { valid: !issues.length, issues, warnings, loads, selected };

  const factor = new Dec(UNIT_FACTORS[spec.unit]);
  for (const load of collectStandardLoads(record)) {
    const { pieces, mpe, covered } = composeLoad(load.mul(factor), selected);
    const limit = mpeAt(spec, load).mul(factor).div(3);
    const pass = covered && mpe.lte(limit);
    const label = `${load} ${spec.unit}`;
    if (!covered) issues.push(`${label}: cannot be made up from the selected weight sets`);
    else if (!pass) {
      issues.push(`${label}: weights MPE ${mpe.mul(1000)} mg exceeds 1/3 of the instrument MPE (${limit.mul(1000).toDecimalPlaces(3)} mg)`);
    }
    loads.push({
      load: load.toString(),
      weightsMpeMg: mpe.mul(1000).toString(),
      limitMg: limit.mul(1000).toDecimalPlaces(4).toString(),
      covered,
      pass,
      pieces,
    });
  }
  return { valid: !issues.length, issues, warnings, loads, selected };
}

export function validateWeightSet(w = {}) {
  const errors = {};
  if (isBlank(w.name)) errors.name = 'Name is required';
  if (!WEIGHT_CLASSES.includes(w.class)) errors.class = 'Select an OIML R 111 class';
  const min = toDec(w.minNominal);
  const max = toDec(w.maxNominal);
  if (!min || !WEIGHT_NOMINALS.some((n) => min.eq(n))) errors.minNominal = 'Select the smallest weight';
  if (!max || !WEIGHT_NOMINALS.some((n) => max.eq(n))) errors.maxNominal = 'Select the largest weight';
  if (min && max && min.gt(max)) errors.maxNominal = 'Largest weight must be ≥ smallest';
  if (isBlank(w.certificateNo)) errors.certificateNo = 'Calibration certificate no. is required';
  if (isBlank(w.dueDate) || Number.isNaN(new Date(w.dueDate).getTime())) errors.dueDate = 'Enter the calibration due date';
  return { valid: Object.keys(errors).length === 0, errors };
}

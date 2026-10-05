import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateTest,
  evaluateCompliance,
  suggestTestLoads,
  checkReferenceWeights,
  composeLoad,
  submissionReadiness,
  TEST_TYPES,
  TEST_MODULES,
  COMPLIANCE,
  ERROR_METHODS,
} from '../src/index.js';

// Class III, 30 kg × 5 g retail scale
const spec = {
  accuracyClass: 'III', unit: 'kg', maxCapacity: '30', minCapacity: '0.1', e: '0.005', d: '', tareDevice: 'subtractive', maxTare: '15',
};
const r = (indication, additionalLoad) => ({ indication, additionalLoad });

test('suggested loads cover Min, changepoints and Max', () => {
  const s = suggestTestLoads(spec);
  assert.deepEqual(s.weighing, ['0.1', '2.5', '10', '15', '30']);
  assert.equal(s.eccentricity, '10');
  assert.deepEqual(s.repeatability, ['15', '30']);
  assert.deepEqual(s.discrimination, ['0.1', '15', '30']);
});

test('zero-setting: E0 = ½d − ΔL within ±0.25e', () => {
  assert.equal(evaluateTest(TEST_TYPES.ZERO_SETTING, { additionalLoad: '0.0015' }, spec).status, COMPLIANCE.PASS);
  const fail = evaluateTest(TEST_TYPES.ZERO_SETTING, { additionalLoad: '0' }, spec);
  assert.equal(fail.status, COMPLIANCE.FAIL); // E0 = 0.0025 > 0.00125
  assert.equal(fail.rows[0].error, '0.0025');
});

function weighingObs(overrides = {}) {
  return {
    method: ERROR_METHODS.CHANGEPOINT,
    zero: { load: '0.05', ...r('0.05', '0.0025') },
    points: suggestTestLoads(spec).weighing.map((load) => ({ load, up: r(load, '0.002'), down: r(load, '0.003'), ...overrides[load] })),
  };
}

test('weighing performance passes and applies E0 correction', () => {
  const res = evaluateTest(TEST_TYPES.WEIGHING, weighingObs(), spec);
  assert.equal(res.status, COMPLIANCE.PASS, res.issues.join('; '));
  assert.equal(res.summary.E0, '0');
  const row = res.rows.find((x) => x.key === '4-up');
  assert.equal(row.correctedError, '0.0005');
  assert.equal(row.mpe, '0.0075');
});

test('weighing performance fails beyond MPE and flags missing readings', () => {
  const fail = evaluateTest(TEST_TYPES.WEIGHING, weighingObs({ 10: { up: r('10.01', '0.001') } }), spec);
  assert.equal(fail.status, COMPLIANCE.FAIL); // Ec = 0.0115 > 0.005
  const incomplete = evaluateTest(TEST_TYPES.WEIGHING, weighingObs({ 30: { down: r('', '') } }), spec);
  assert.equal(incomplete.status, COMPLIANCE.PENDING);
  assert.match(incomplete.issues[0], /decreasing reading missing/);
});

test('ΔL outside 0..d is rejected', () => {
  const res = evaluateTest(TEST_TYPES.WEIGHING, weighingObs({ 15: { up: r('15', '0.01') } }), spec);
  assert.equal(res.status, COMPLIANCE.PENDING);
  assert.match(res.rows.find((x) => x.key === '3-up').invalid, /ΔL must be between/);
});

test('eccentricity fails when one corner is off', () => {
  const positions = { C: r('10', '0.0025'), 1: r('10', '0.002'), 2: r('10', '0.003'), 3: r('10.015', '0.001'), 4: r('10', '0.0025') };
  const res = evaluateTest(TEST_TYPES.ECCENTRICITY, { load: '10', positions }, spec);
  assert.equal(res.status, COMPLIANCE.FAIL);
  assert.equal(res.rows.find((x) => x.key === '3').pass, false);
});

test('repeatability checks spread against MPE', () => {
  const series = (load, dls) => ({ load, readings: dls.map((dl) => r(load, dl)) });
  const ok = evaluateTest(TEST_TYPES.REPEATABILITY, { series: [series('15', ['0.001', '0.002', '0.003']), series('30', ['0.002', '0.002', '0.004'])] }, spec);
  assert.equal(ok.status, COMPLIANCE.PASS);
  assert.equal(ok.summary.series[0].spread, '0.002');
  const direct = evaluateTest(
    TEST_TYPES.REPEATABILITY,
    { method: ERROR_METHODS.DIRECT, series: [{ load: '15', readings: [r('15'), r('15.005'), r('14.995')] }, { load: '30', readings: [r('30'), r('30'), r('30')] }] },
    spec,
  );
  assert.equal(direct.status, COMPLIANCE.FAIL); // spread 0.01 > 0.0075
});

test('discrimination requires a change of at least d', () => {
  const points = ['0.1', '15', '30'].map((load) => ({ load, indicationBefore: load, indicationAfter: String(Number(load) + 0.005) }));
  assert.equal(evaluateTest(TEST_TYPES.DISCRIMINATION, { points }, spec).status, COMPLIANCE.PASS);
  points[1].indicationAfter = '15';
  assert.equal(evaluateTest(TEST_TYPES.DISCRIMINATION, { points }, spec).status, COMPLIANCE.FAIL);
});

test('tare uses MPE of the net load and is N/A without a tare device', () => {
  const obs = { tareLoad: '10', zero: r('0', '0.0025'), points: [{ netLoad: '20', ...r('20', '0.002') }] };
  assert.equal(evaluateTest(TEST_TYPES.TARE, obs, spec).status, COMPLIANCE.PASS);
  assert.equal(evaluateTest(TEST_TYPES.TARE, { ...obs, points: [{ netLoad: '25', ...r('25', '0') }] }, spec).status, COMPLIANCE.PENDING);
  assert.equal(evaluateTest(TEST_TYPES.TARE, obs, { ...spec, tareDevice: 'none' }).status, COMPLIANCE.NOT_APPLICABLE);
});

test('defaults() produce observations every evaluator accepts', () => {
  for (const t of TEST_MODULES) {
    const res = evaluateTest(t.type, t.defaults(spec), spec);
    assert.equal(res.status, COMPLIANCE.PENDING, t.type);
  }
});

const sets = [
  { id: 'f1', name: 'F1 1 mg–5 kg', class: 'F1', minNominal: '0.001', maxNominal: '5000', dueDate: '2099-01-01' },
  { id: 'm1', name: 'M1 10–20 kg', class: 'M1', minNominal: '10000', maxNominal: '20000', dueDate: '2099-01-01' },
];

test('composeLoad uses the most accurate set covering each piece', () => {
  const c = composeLoad('35000', sets); // 20 kg M1 + 10 kg M1 + 5 kg F1
  assert.deepEqual(c.pieces.map((p) => [p.nominal, p.count, p.class]), [['20000', 1, 'M1'], ['10000', 1, 'M1'], ['5000', 1, 'F1']]);
  assert.equal(c.mpe.toString(), '1.525');
  assert.equal(c.covered, true);
});

test('reference weights: 1/3 MPE rule and expiry', () => {
  const record = { instrument: spec, environment: { testDate: '2026-09-01' }, referenceWeights: ['f1', 'm1'], tests: { [TEST_TYPES.WEIGHING]: weighingObs() } };
  const ok = checkReferenceWeights(record, sets);
  assert.equal(ok.valid, true, ok.issues.join('; '));

  const fineScale = { ...spec, accuracyClass: 'I', unit: 'g', maxCapacity: '220', minCapacity: '0.1', e: '0.001' };
  const bad = checkReferenceWeights(
    { ...record, instrument: fineScale, tests: { [TEST_TYPES.ECCENTRICITY]: { load: '100' } } },
    sets,
  );
  assert.equal(bad.valid, false); // F1 100 g MPE 0.5 mg > (1 mg / 3)

  const expired = checkReferenceWeights(record, [{ ...sets[0], dueDate: '2026-01-01' }, sets[1]]);
  assert.match(expired.issues[0], /expired/);
});

test('submission readiness lists what is missing', () => {
  const res = submissionReadiness({ instrument: spec, tests: {} }, sets);
  assert.equal(res.ready, false);
  assert.ok(res.issues.some((i) => /Weighing Performance/.test(i)));
  assert.ok(res.issues.some((i) => /reference weight/.test(i)));
  assert.equal(evaluateCompliance({ instrument: spec, tests: {} }).overall, COMPLIANCE.PENDING);
});

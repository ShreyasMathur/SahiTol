import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMPE,
  mpeSchedule,
  indicationError,
  isPreferredStep,
  validateInstrumentSpec,
  validateEnvironment,
  VERIFICATION_TYPES,
} from '../src/index.js';

test('MPE bands for class III (e = 5 g)', () => {
  const at = (load) => calculateMPE({ accuracyClass: 'III', e: '5', load }).mpe.toString();
  assert.equal(at('0'), '2.5');
  assert.equal(at('2500'), '2.5'); // 500e, inclusive
  assert.equal(at('2505'), '5');
  assert.equal(at('10000'), '5'); // 2000e
  assert.equal(at('30000'), '7.5');
});

test('in-service MPE is twice initial', () => {
  const { mpe } = calculateMPE({ accuracyClass: 'II', e: '0.1', load: '100', verificationType: VERIFICATION_TYPES.IN_SERVICE });
  assert.equal(mpe.toString(), '0.1');
});

test('MPE schedule is clipped at Max', () => {
  const rows = mpeSchedule({ accuracyClass: 'III', e: '0.01', maxCapacity: '15' });
  assert.deepEqual(rows.map((r) => [r.from, r.to, r.mpe]), [
    ['0', '5', '0.005'],
    ['5', '15', '0.01'],
  ]);
});

test('indication error uses changepoint formula', () => {
  // I = 1000, e = 1, ΔL = 0.3 → P = 1000.2, E = 0.2
  assert.equal(indicationError({ indication: '1000', load: '1000', additionalLoad: '0.3', d: '1' }).toString(), '0.2');
});

test('preferred step detection avoids float error', () => {
  for (const v of ['0.001', '0.002', '0.005', '1', '20', '500', '1000']) assert.ok(isPreferredStep(v), v);
  for (const v of ['0.003', '3', '25', '0']) assert.ok(!isPreferredStep(v), v);
});

test('valid class III retail scale', () => {
  const r = validateInstrumentSpec({ accuracyClass: 'III', unit: 'kg', maxCapacity: '30', minCapacity: '0.1', e: '0.005' });
  assert.equal(r.valid, true, JSON.stringify(r.errors));
  assert.equal(r.derived.n, '6000');
});

test('rejects Min below class lower limit and n out of range', () => {
  const r = validateInstrumentSpec({ accuracyClass: 'III', unit: 'kg', maxCapacity: '300', minCapacity: '0.05', e: '0.005' });
  assert.match(r.errors.maxCapacity, /n = Max\/e/);
  assert.match(r.errors.minCapacity, /at least 20e/);
});

test('rejects physically impossible environment', () => {
  const r = validateEnvironment({ temperatureStart: '20', humidityStart: '120', pressure: '50' });
  assert.ok(r.errors.humidityStart);
  assert.ok(r.errors.pressure);
});

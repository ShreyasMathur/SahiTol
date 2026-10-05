import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SAMPLE_RECORDS,
  checkReferenceWeights,
  evaluateCompliance,
  sampleRecordData,
  sampleWeightSets,
  validateRecord,
} from '../src/index.js';

const sets = sampleWeightSets().map((w) => ({ ...w, id: w.key }));

for (const sample of SAMPLE_RECORDS) {
  test(`${sample.key}: ${sample.title}`, () => {
    const record = { ...sampleRecordData(sample), referenceWeights: sample.weights };
    assert.equal(validateRecord(record).valid, true, 'sample data-entry sections must be valid');

    const { overall, tests } = evaluateCompliance(record);
    for (const [type, expected] of Object.entries(sample.expected.tests)) {
      assert.equal(tests[type].status, expected, `${type}: ${JSON.stringify(tests[type].issues)}`);
    }
    assert.equal(overall, sample.expected.overall);

    const weights = checkReferenceWeights(record, sets);
    assert.deepEqual(weights.issues, [], 'sample weights must cover every load within 1/3 MPE');
  });
}

test('S-01: an error exactly equal to the MPE passes', () => {
  const { tests } = evaluateCompliance(sampleRecordData(SAMPLE_RECORDS[0]));
  const row = tests.weighingPerformance.rows.find((r) => r.key === '3-up');
  assert.equal(row.correctedError, '0.0075');
  assert.equal(row.mpe, '0.0075');
  assert.equal(row.pass, true);
});

test('S-02: MPE at exactly 2000e is 1e, so +6.5 g fails at position 3', () => {
  const { tests } = evaluateCompliance(sampleRecordData(SAMPLE_RECORDS[1]));
  const row = tests.eccentricity.rows.find((r) => r.key === '3');
  assert.equal(row.mpe, '0.005');
  assert.equal(row.correctedError, '0.0065');
  assert.equal(row.pass, false);
  assert.equal(tests.eccentricity.rows.filter((r) => r.pass === false).length, 1);
});

test('S-03: repeatability fails on spread while each reading passes', () => {
  const { tests } = evaluateCompliance(sampleRecordData(SAMPLE_RECORDS[2]));
  const [s1, s2] = tests.repeatability.summary.series;
  assert.equal(s1.spread, '0.07');
  assert.equal(s1.pass, false);
  assert.equal(s2.pass, true);
  assert.ok(tests.repeatability.rows.every((r) => r.pass === true));
});

test('S-04: the same readings fail when judged as an initial verification', () => {
  const data = sampleRecordData(SAMPLE_RECORDS[3]);
  assert.equal(evaluateCompliance(data).overall, 'PASS');
  const initial = { ...data, instrument: { ...data.instrument, verificationType: 'initial' } };
  const { overall, tests } = evaluateCompliance(initial);
  assert.equal(overall, 'FAIL');
  assert.equal(tests.weighingPerformance.status, 'FAIL');
  assert.equal(tests.eccentricity.status, 'FAIL');
  // 200.012 g → +0.012 g > initial MPE 0.01 g at 20000e
  assert.equal(tests.repeatability.status, 'FAIL');
  assert.equal(tests.discrimination.status, 'PASS');
});

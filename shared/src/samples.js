/**
 * Optional sample data for checking the calculation engine: reference weight
 * sets and four test records whose verdicts were worked out by hand. An
 * administrator loads and removes them from the app; nothing is loaded by default.
 *
 * Every reading uses the changepoint method E = I + ½d − ΔL − L (R 76-1 A.4.4.3)
 * unless stated, with the zero reading chosen so that E0 = 0, i.e. Ec = E.
 */

const DAY = 86_400_000;
const isoDate = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

/** Certificate numbers of sample weight sets start with this, which is how they are recognised. */
export const SAMPLE_CERT_PREFIX = 'SAMPLE-';
export const SAMPLE_REFERENCE_PREFIX = 'SAMPLE/NAWI';

export const sampleWeightSets = () => [
  { key: 'f1', name: 'Sample WS-01 · F1 set 1 mg – 5 kg', class: 'F1', minNominal: '0.001', maxNominal: '5000', certificateNo: `${SAMPLE_CERT_PREFIX}CAL-F1-001`, calibrationLab: 'Sample calibration laboratory', calibratedOn: isoDate(-60), dueDate: isoDate(305) },
  { key: 'e2', name: 'Sample WS-02 · E2 set 1 mg – 200 g', class: 'E2', minNominal: '0.001', maxNominal: '200', certificateNo: `${SAMPLE_CERT_PREFIX}CAL-E2-002`, calibrationLab: 'Sample calibration laboratory', calibratedOn: isoDate(-60), dueDate: isoDate(305) },
  { key: 'm1', name: 'Sample WS-03 · M1 set 10 kg – 20 kg', class: 'M1', minNominal: '10000', maxNominal: '20000', certificateNo: `${SAMPLE_CERT_PREFIX}CAL-M1-003`, calibrationLab: 'Sample calibration laboratory', calibratedOn: isoDate(-60), dueDate: isoDate(305) },
  { key: 'm1-50', name: 'Sample WS-04 · M1 50 kg blocks', class: 'M1', minNominal: '50000', maxNominal: '50000', certificateNo: `${SAMPLE_CERT_PREFIX}CAL-M1-004`, calibrationLab: 'Sample calibration laboratory', calibratedOn: isoDate(-60), dueDate: isoDate(305) },
];

const environment = () => ({
  labName: 'Sample data — not a real test',
  testDate: isoDate(0),
  temperatureStart: '21.5',
  temperatureEnd: '22.0',
  humidityStart: '48',
  humidityEnd: '50',
  pressure: '1011.0',
});

const cp = (indication, additionalLoad) => ({ indication, additionalLoad });
const direct = (indication) => ({ indication, additionalLoad: '' });

// Class III, Max 30 kg, e = d = 5 g → MPE (initial): ≤ 2.5 kg ±2.5 g, ≤ 10 kg ±5 g, above ±7.5 g
const scale30 = {
  instrumentType: 'Electronic counter scale',
  accuracyClass: 'III',
  unit: 'kg',
  maxCapacity: '30',
  minCapacity: '0.1',
  e: '0.005',
  d: '',
  verificationType: 'initial',
};

const weighing30 = {
  method: 'changepoint',
  zero: { load: '0.05', ...cp('0.05', '0.0025') }, // E0 = 0.05 + 0.0025 − 0.0025 − 0.05 = 0
  points: [
    { load: '0.1', up: cp('0.1', '0.001'), down: cp('0.1', '0.002') }, //       +1.5 g, +0.5 g ≤ 2.5 g
    { load: '2.5', up: cp('2.5', '0.0005'), down: cp('2.5', '0.0015') }, //     +2.0 g, +1.0 g ≤ 2.5 g (500e: still the 0.5e band)
    { load: '10', up: cp('10.005', '0.003'), down: cp('10', '0.001') }, //      +4.5 g, +1.5 g ≤ 5 g
    { load: '15', up: cp('15.005', '0'), down: cp('15.005', '0.002') }, //      +7.5 g (= MPE, passes), +5.5 g ≤ 7.5 g
    { load: '30', up: cp('30.005', '0.001'), down: cp('30', '0.001') }, //      +6.5 g, +1.5 g ≤ 7.5 g
  ],
};

const repeatability30 = {
  method: 'changepoint',
  series: [
    { load: '15', readings: [cp('15', '0.001'), cp('15', '0.002'), cp('15', '0.0015')] }, // +1.5, +0.5, +1.0 g → spread 1 g ≤ 7.5 g
    { load: '30', readings: [cp('30', '0.002'), cp('30', '0.001'), cp('30', '0.002')] }, //  +0.5, +1.5, +0.5 g → spread 1 g ≤ 7.5 g
  ],
};

const discrimination30 = {
  points: [
    { load: '0.1', indicationBefore: '0.1', indicationAfter: '0.105' },
    { load: '15', indicationBefore: '15', indicationAfter: '15.005' },
    { load: '30', indicationBefore: '30', indicationAfter: '30.005' },
  ],
};

export const SAMPLE_RECORDS = [
  {
    key: 'S-01',
    title: 'Conforming class III scale, error exactly at the MPE',
    purpose:
      'Every test passes. At 15 kg (3000e) the increasing reading gives E = 15.005 + 0.0025 − 0 − 15 = +0.0075 kg, exactly the MPE of 1.5e — an error equal to the MPE is acceptable.',
    weights: ['f1', 'm1'],
    manufacturer: { name: 'Sample Scales Co.', address: 'Sample data', country: 'India' },
    model: { modelName: 'SMP-30T', serialNumber: 'SAMPLE-0001', yearOfManufacture: '2026' },
    instrument: { ...scale30, tareDevice: 'subtractive', maxTare: '15' },
    tests: {
      zeroSetting: { additionalLoad: '0.002' }, // E0 = ½d − ΔL = 0.0025 − 0.002 = +0.5 g ≤ 0.25e = 1.25 g
      weighingPerformance: weighing30,
      eccentricity: {
        method: 'changepoint',
        load: '10',
        zero: { load: '0.05', ...cp('0.05', '0.0025') },
        positions: {
          C: cp('10', '0.002'), //      +0.5 g
          1: cp('10', '0.001'), //      +1.5 g
          2: cp('10', '0.003'), //      −0.5 g
          3: cp('10.005', '0.004'), //  +3.5 g
          4: cp('10', '0.0025'), //      0.0 g   — all ≤ 5 g
        },
      },
      repeatability: repeatability30,
      discrimination: discrimination30,
      tare: {
        method: 'changepoint',
        tareLoad: '10',
        zero: { indication: '0', additionalLoad: '0.0025' }, // net zero: E0 = 0
        points: [
          { netLoad: '0.1', ...cp('0.1', '0.002') }, //     +0.5 g ≤ 2.5 g
          { netLoad: '2.5', ...cp('2.5', '0.001') }, //     +1.5 g ≤ 2.5 g
          { netLoad: '10', ...cp('10', '0.001') }, //       +1.5 g ≤ 5 g
          { netLoad: '20', ...cp('20.005', '0.002') }, //   +5.5 g ≤ 7.5 g (MPE of the net load)
        ],
      },
    },
    expected: {
      overall: 'PASS',
      tests: { zeroSetting: 'PASS', weighingPerformance: 'PASS', eccentricity: 'PASS', repeatability: 'PASS', discrimination: 'PASS', tare: 'PASS' },
    },
  },
  {
    key: 'S-02',
    title: 'Eccentricity failure at an MPE band edge',
    purpose:
      'The test load of 10 kg is exactly 2000e, which still belongs to the ±1e band, so MPE = 5 g. Position 3 reads E = 10.005 + 0.0025 − 0.001 − 10 = +6.5 g > 5 g → FAIL. (Had the band edge been handled wrongly the MPE would be 7.5 g and it would pass.) The scale has no tare device, so the tare test is not applicable.',
    weights: ['f1', 'm1'],
    manufacturer: { name: 'Sample Scales Co.', address: 'Sample data', country: 'India' },
    model: { modelName: 'SMP-30', serialNumber: 'SAMPLE-0002', yearOfManufacture: '2026' },
    instrument: { ...scale30, tareDevice: 'none', maxTare: '' },
    tests: {
      zeroSetting: { additionalLoad: '0.003' }, // E0 = 0.0025 − 0.003 = −0.5 g ≤ 1.25 g
      weighingPerformance: weighing30,
      eccentricity: {
        method: 'changepoint',
        load: '10',
        zero: { load: '0.05', ...cp('0.05', '0.0025') },
        positions: {
          C: cp('10', '0.002'), //      +0.5 g
          1: cp('10', '0.001'), //      +1.5 g
          2: cp('10.005', '0.004'), //  +3.5 g
          3: cp('10.005', '0.001'), //  +6.5 g  > 5 g  ✕
          4: cp('10', '0.003'), //      −0.5 g
        },
      },
      repeatability: repeatability30,
      discrimination: discrimination30,
    },
    expected: {
      overall: 'FAIL',
      tests: { zeroSetting: 'PASS', weighingPerformance: 'PASS', eccentricity: 'FAIL', repeatability: 'PASS', discrimination: 'PASS', tare: 'NA' },
    },
  },
  {
    key: 'S-03',
    title: 'Repeatability failure although every reading is within the MPE',
    purpose:
      'Class III platform scale, Max 150 kg, e = 50 g. At 75 kg (MPE ±50 g) the three errors are +25 g, −25 g and +45 g — each within ±50 g — but their spread is 45 − (−25) = 70 g > 50 g, so repeatability fails.',
    weights: ['f1', 'm1', 'm1-50'],
    manufacturer: { name: 'Sample Weighing Systems', address: 'Sample data', country: 'India' },
    model: { modelName: 'SMP-150P', serialNumber: 'SAMPLE-0003', yearOfManufacture: '2025' },
    // MPE (initial): ≤ 25 kg ±25 g, ≤ 100 kg ±50 g, above ±75 g
    instrument: { instrumentType: 'Platform scale', accuracyClass: 'III', unit: 'kg', maxCapacity: '150', minCapacity: '1', e: '0.05', d: '', tareDevice: 'none', maxTare: '', verificationType: 'initial' },
    tests: {
      zeroSetting: { additionalLoad: '0.02' }, // E0 = 0.025 − 0.02 = +5 g ≤ 12.5 g
      weighingPerformance: {
        method: 'changepoint',
        zero: { load: '0.5', ...cp('0.5', '0.025') },
        points: [
          { load: '1', up: cp('1', '0.02'), down: cp('1', '0.01') }, //             +5, +15 g ≤ 25 g
          { load: '25', up: cp('25', '0.01'), down: cp('25', '0.02') }, //          +15, +5 g ≤ 25 g
          { load: '75', up: cp('75', '0.01'), down: cp('75', '0.03') }, //          +15, −5 g ≤ 50 g
          { load: '100', up: cp('100.05', '0.04'), down: cp('100', '0.01') }, //    +35, +15 g ≤ 50 g
          { load: '150', up: cp('150.05', '0.03'), down: cp('150', '0.02') }, //    +45, +5 g ≤ 75 g
        ],
      },
      eccentricity: {
        method: 'changepoint',
        load: '50',
        zero: { load: '0.5', ...cp('0.5', '0.025') },
        positions: { C: cp('50', '0.02'), 1: cp('50', '0.01'), 2: cp('50.05', '0.04'), 3: cp('50', '0.03'), 4: cp('50', '0.025') }, // +5, +15, +35, −5, 0 g ≤ 50 g
      },
      repeatability: {
        method: 'changepoint',
        series: [
          { load: '75', readings: [cp('75', '0'), cp('75', '0.05'), cp('75.05', '0.03')] }, //   +25, −25, +45 g → spread 70 g > 50 g ✕
          { load: '150', readings: [cp('150', '0.02'), cp('150', '0.02'), cp('150', '0.02')] }, // +5 g ×3 → spread 0
        ],
      },
      discrimination: {
        points: [
          { load: '1', indicationBefore: '1', indicationAfter: '1.05' },
          { load: '75', indicationBefore: '75', indicationAfter: '75.05' },
          { load: '150', indicationBefore: '150', indicationAfter: '150.05' },
        ],
      },
    },
    expected: {
      overall: 'FAIL',
      tests: { zeroSetting: 'PASS', weighingPerformance: 'PASS', eccentricity: 'PASS', repeatability: 'FAIL', discrimination: 'PASS', tare: 'NA' },
    },
  },
  {
    key: 'S-04',
    title: 'In-service balance that would fail initial verification',
    purpose:
      'Class II balance, Max 200 g, e = 0.01 g, d = 0.001 g, direct reading (E = I − L). In service the MPE is twice the initial MPE. At 150 g (15000e) the error +0.015 g exceeds the initial MPE of 0.01 g but is within the in-service MPE of 0.02 g, so the record passes. Change the verification type to “initial” and weighing performance, eccentricity and repeatability fail.',
    weights: ['e2'],
    manufacturer: { name: 'Sample Instruments', address: 'Sample data', country: 'India' },
    model: { modelName: 'SMP-200B', serialNumber: 'SAMPLE-0004', yearOfManufacture: '2024' },
    // MPE in service: ≤ 50 g ±0.01 g, ≤ 200 g ±0.02 g
    instrument: { instrumentType: 'Precision balance', accuracyClass: 'II', unit: 'g', maxCapacity: '200', minCapacity: '0.2', e: '0.01', d: '0.001', tareDevice: 'none', maxTare: '', verificationType: 'inService' },
    tests: {
      zeroSetting: { additionalLoad: '0.0003' }, // E0 = ½d − ΔL = 0.0005 − 0.0003 = +0.0002 g ≤ 0.25e = 0.0025 g
      weighingPerformance: {
        method: 'direct',
        zero: { load: '0.1', ...direct('0.1') }, // E0 = 0
        points: [
          { load: '0.2', up: direct('0.201'), down: direct('0.2') }, //        +0.001, 0     ≤ 0.01
          { load: '50', up: direct('50.004'), down: direct('50.002') }, //     +0.004, +0.002 ≤ 0.01
          { load: '100', up: direct('100.008'), down: direct('100.005') }, //  +0.008, +0.005 ≤ 0.02
          { load: '150', up: direct('150.015'), down: direct('150.012') }, //  +0.015, +0.012 ≤ 0.02 (initial MPE 0.01 ✕)
          { load: '200', up: direct('200.012'), down: direct('200.009') }, //  +0.012, +0.009 ≤ 0.02
        ],
      },
      eccentricity: {
        method: 'direct',
        load: '66',
        zero: { load: '0.1', ...direct('0.1') },
        positions: { C: direct('66.002'), 1: direct('66.006'), 2: direct('65.998'), 3: direct('66.012'), 4: direct('66.004') }, // max +0.012 ≤ 0.02 (initial 0.01 ✕)
      },
      repeatability: {
        method: 'direct',
        series: [
          { load: '100', readings: [direct('100.005'), direct('100.007'), direct('100.004')] }, // spread 0.003 ≤ 0.02
          { load: '200', readings: [direct('200.010'), direct('200.012'), direct('200.009')] }, // spread 0.003 ≤ 0.02
        ],
      },
      discrimination: {
        points: [
          { load: '0.2', indicationBefore: '0.2', indicationAfter: '0.201' }, // change = d → pass
          { load: '100', indicationBefore: '100', indicationAfter: '100.001' },
          { load: '200', indicationBefore: '200', indicationAfter: '200.001' },
        ],
      },
    },
    expected: {
      overall: 'PASS',
      tests: { zeroSetting: 'PASS', weighingPerformance: 'PASS', eccentricity: 'PASS', repeatability: 'PASS', discrimination: 'PASS', tare: 'NA' },
    },
  },
];

/** A sample record in the shape the record service accepts, with its expectation attached. */
export function sampleRecordData(sample) {
  const { key, title, purpose, expected, manufacturer, model, instrument, tests } = sample;
  return {
    manufacturer,
    model,
    instrument,
    environment: environment(),
    tests,
    sample: { key, title, purpose, expected },
  };
}

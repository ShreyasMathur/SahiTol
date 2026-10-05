import {
  ACCURACY_CLASS_LABELS,
  COMPLIANCE,
  ERROR_METHODS,
  TARE_DEVICES,
  TEST_MODULES,
  TEST_TYPES,
  VERIFICATION_TYPES,
  checkReferenceWeights,
  evaluateCompliance,
  formatMass,
  validateInstrumentSpec,
} from '@nawi/shared';

const v = (x) => (x === null || x === undefined || x === '' ? '—' : String(x));
const result = (pass) => (pass === true ? 'PASS' : pass === false ? 'FAIL' : '—');
const withUnit = (x, u) => (x === null || x === undefined || x === '' ? '—' : `${x} ${u}`);
const date = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '—');
const dateTime = (iso) => (iso ? new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '—');

export const STATUS_TEXT = {
  [COMPLIANCE.PASS]: 'PASS',
  [COMPLIANCE.FAIL]: 'FAIL',
  [COMPLIANCE.PENDING]: 'INCOMPLETE',
  [COMPLIANCE.NOT_APPLICABLE]: 'N/A',
};

const VERDICT_TEXT = {
  [COMPLIANCE.PASS]: 'The instrument CONFORMS to the requirements of OIML R 76-1 for the tests performed.',
  [COMPLIANCE.FAIL]: 'The instrument DOES NOT CONFORM to the requirements of OIML R 76-1.',
  [COMPLIANCE.PENDING]: 'Testing is incomplete — no conformity decision can be made.',
};

const TARE_TEXT = {
  [TARE_DEVICES.NONE]: 'None',
  [TARE_DEVICES.SUBTRACTIVE]: 'Subtractive',
  [TARE_DEVICES.ADDITIVE]: 'Additive',
};

const METHOD_TEXT = {
  [ERROR_METHODS.CHANGEPOINT]: 'Changepoint method: E = I + ½d − ΔL − L, Ec = E − E0',
  [ERROR_METHODS.DIRECT]: 'Direct reading: E = I − L, Ec = E − E0',
};

/** Valid measurement rows, excluding the E0 zero reading (reported as a line). */
const ok = (rows) => rows.filter((r) => !r.invalid && r.key !== 'zero');

/** Per-test detail: explanatory lines and tables, built from the evaluator output. */
function testDetail(type, res, obs = {}, u) {
  const lines = [];
  const tables = [];
  const method = obs.method ?? ERROR_METHODS.CHANGEPOINT;
  const dL = (r) => (method === ERROR_METHODS.DIRECT ? '—' : v(r.additionalLoad));

  switch (type) {
    case TEST_TYPES.ZERO_SETTING:
      lines.push('E0 = ½d − ΔL after zero-setting; limit ±0.25e (R 76-1 4.5.2).');
      tables.push({
        headers: [`ΔL (${u})`, `E0 (${u})`, `Limit (${u})`, 'Result'],
        rows: ok(res.rows).map((r) => [v(r.additionalLoad), v(r.error), `±${r.limit}`, result(r.pass)]),
      });
      break;
    case TEST_TYPES.WEIGHING:
      lines.push(METHOD_TEXT[method], `E0 = ${v(res.summary.E0)} ${u}`);
      tables.push({
        headers: [`Load (${u})`, 'Direction', `I (${u})`, `ΔL (${u})`, `E (${u})`, `Ec (${u})`, `MPE (±${u})`, 'Result'],
        rows: ok(res.rows).map((r) => [v(r.load), r.direction === 'up' ? 'Up' : 'Down', v(r.indication), dL(r), v(r.error), v(r.correctedError), v(r.mpe), result(r.pass)]),
      });
      break;
    case TEST_TYPES.ECCENTRICITY:
      lines.push(METHOD_TEXT[method], `Test load ${withUnit(res.summary.load, u)}; E0 = ${v(res.summary.E0)} ${u}`);
      tables.push({
        headers: ['Position', `I (${u})`, `ΔL (${u})`, `E (${u})`, `Ec (${u})`, `MPE (±${u})`, 'Result'],
        rows: ok(res.rows).map((r) => [r.position, v(r.indication), dL(r), v(r.error), v(r.correctedError), v(r.mpe), result(r.pass)]),
      });
      break;
    case TEST_TYPES.REPEATABILITY:
      lines.push(METHOD_TEXT[method].split(',')[0], 'Spread of errors in each series must not exceed |MPE|.');
      tables.push({
        headers: ['Series', `Load (${u})`, 'Reading', `I (${u})`, `ΔL (${u})`, `E (${u})`, 'Result'],
        rows: ok(res.rows).map((r) => [v(r.series), v(r.load), v(r.reading), v(r.indication), dL(r), v(r.error), result(r.pass)]),
      });
      tables.push({
        headers: ['Series', `Load (${u})`, 'Readings', `Spread (${u})`, `MPE (${u})`, 'Result'],
        rows: (res.summary.series ?? []).map((s) => [String(s.key + 1), v(s.load), String(s.count), v(s.spread), v(s.mpe), result(s.pass)]),
      });
      break;
    case TEST_TYPES.DISCRIMINATION:
      lines.push(`Extra load 1.4d = ${v(res.summary.extraLoad)} ${u} must change the indication by at least d.`);
      tables.push({
        headers: [`Load (${u})`, `I before (${u})`, `I after (${u})`, `Change (${u})`, `Required (${u})`, 'Result'],
        rows: ok(res.rows).map((r) => [v(r.load), v(r.indicationBefore), v(r.indicationAfter), v(r.change), `≥ ${r.required}`, result(r.pass)]),
      });
      break;
    case TEST_TYPES.TARE:
      if (res.status === COMPLIANCE.NOT_APPLICABLE) break;
      lines.push(METHOD_TEXT[method], `Tare load ${withUnit(res.summary.tareLoad, u)}; E0 (net zero) = ${v(res.summary.E0)} ${u}`);
      tables.push({
        headers: [`Net load (${u})`, `I (${u})`, `ΔL (${u})`, `E (${u})`, `Ec (${u})`, `MPE (±${u})`, 'Result'],
        rows: ok(res.rows).map((r) => [v(r.netLoad), v(r.indication), dL(r), v(r.error), v(r.correctedError), v(r.mpe), result(r.pass)]),
      });
      break;
    default:
  }
  if (res.status === COMPLIANCE.NOT_APPLICABLE) lines.push(res.notes);
  if (res.status === COMPLIANCE.PENDING) lines.push(`Incomplete: ${res.issues[0] ?? res.notes}`);
  return { lines, tables: tables.filter((t) => t.rows.length) };
}

/**
 * Normalised, format-independent report content. PDF and DOCX renderers both
 * consume this, so the two exports can never disagree.
 */
export function buildReportModel({ record, attachments = [], weightSets = [], draft, verifyUrl, labName }) {
  const { manufacturer: m = {}, model = {}, instrument: s = {}, environment: env = {} } = record;
  const u = s.unit ?? '';
  const spec = validateInstrumentSpec(s);
  const evaluation = evaluateCompliance(record);
  const weights = checkReferenceWeights(record, weightSets);
  const selectedSets = weights.selected ?? [];

  const tests = TEST_MODULES.map((t) => {
    const res = evaluation.tests[t.type];
    return { title: t.label, reference: t.reference, status: res.status, ...testDetail(t.type, res, record.tests?.[t.type], u) };
  });

  return {
    labName,
    title: 'TEST REPORT',
    subtitle: 'Non-automatic weighing instrument — OIML R 76-1',
    referenceNo: record.referenceNo,
    revision: record.revision ?? 0,
    revisionOf: record.revisionOf,
    status: record.status,
    draft,
    sample: Boolean(record.sample),
    issuedAt: record.reviewedAt ? date(record.reviewedAt) : null,
    verifyUrl,
    recordHash: record.recordHash ?? null,

    fieldSections: [
      {
        title: '1. Applicant / manufacturer',
        fields: [['Name', m.name], ['Address', m.address], ['Country', m.country], ['Email', m.email], ['Phone', m.phone]],
      },
      {
        title: '2. Instrument identification',
        fields: [
          ['Instrument type', s.instrumentType],
          ['Model', model.modelName],
          ['Serial number', model.serialNumber],
          ['Year of manufacture', model.yearOfManufacture],
          ['Model approval no.', model.approvalCertificateNo],
          ['Software version', model.softwareVersion],
        ],
      },
      {
        title: '3. Metrological characteristics',
        fields: [
          ['Accuracy class', ACCURACY_CLASS_LABELS[s.accuracyClass]],
          ['Verification', s.verificationType === VERIFICATION_TYPES.IN_SERVICE ? 'In-service inspection' : 'Initial verification'],
          ['Max', withUnit(s.maxCapacity, u)],
          ['Min', withUnit(s.minCapacity, u)],
          ['e', withUnit(s.e, u)],
          ['d', withUnit(s.d || s.e, u)],
          ['n = Max/e', spec.derived.n],
          ['Tare device', TARE_TEXT[s.tareDevice ?? TARE_DEVICES.NONE]],
          ['Maximum tare', s.maxTare ? withUnit(s.maxTare, u) : null],
        ],
      },
      {
        title: '4. Test conditions',
        fields: [
          ['Laboratory', env.labName],
          ['Test date', env.testDate],
          ['Temperature', env.temperatureStart ? `${env.temperatureStart} °C (start), ${env.temperatureEnd || '—'} °C (end)` : null],
          ['Relative humidity', env.humidityStart ? `${env.humidityStart} %RH (start), ${env.humidityEnd || '—'} %RH (end)` : null],
          ['Barometric pressure', withUnit(env.pressure, 'hPa')],
        ],
      },
    ].map((sec) => ({ ...sec, fields: sec.fields.map(([label, value]) => [label, v(value)]) })),

    weights: {
      title: '5. Reference standards',
      sets: {
        headers: ['Weight set', 'Class (R 111)', 'Range', 'Certificate no.', 'Calibrated by', 'Due date'],
        rows: selectedSets.map((w) => [w.name, w.class, `${formatMass(w.minNominal)} – ${formatMass(w.maxNominal)}`, v(w.certificateNo), v(w.calibrationLab), v(w.dueDate)]),
      },
      loads: {
        headers: [`Load (${u})`, 'Weights MPE (mg)', 'Limit 1/3 MPE (mg)', 'Result'],
        rows: weights.loads.map((l) => [l.load, l.weightsMpeMg, l.limitMg, result(l.pass)]),
      },
      note: weights.valid
        ? 'Every standard load meets the requirement that weight errors do not exceed 1/3 of the instrument MPE (R 76-1 3.7.1).'
        : weights.issues.join(' '),
    },

    summary: {
      title: '6. Summary of results',
      headers: ['Test', 'Reference', 'Result'],
      rows: tests.map((t) => [t.title, t.reference, STATUS_TEXT[t.status]]),
    },
    tests,
    verdict: { status: evaluation.overall, label: STATUS_TEXT[evaluation.overall], text: VERDICT_TEXT[evaluation.overall] },
    remarks: record.reviewComment || null,

    photos: attachments.map((a) => ({ dataUrl: a.dataUrl, caption: a.caption || a.name || 'Photograph' })),
    signatures: [
      { heading: 'Tested by', ...(record.signatures?.technician ?? {}) },
      { heading: 'Approved by', ...(record.signatures?.inspector ?? {}) },
    ].map((sig) => ({ ...sig, signedAt: sig.signedAt ? dateTime(sig.signedAt) : null })),
  };
}

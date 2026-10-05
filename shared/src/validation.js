import { Dec, isBlank, isFiniteNumber, isPreferredStep } from './math.js';
import { ACCURACY_CLASSES, TARE_DEVICES, UNIT_FACTORS } from './constants.js';

/**
 * Accuracy class requirements, OIML R 76-1:2006 Table 3. e bounds are in grams;
 * n = Max/e; `minInE` is the lower limit for Min expressed in e.
 */
export const CLASS_REQUIREMENTS = {
  I: [{ eMin: '0.001', eMax: null, nMin: 50000, nMax: null, minInE: 100 }],
  II: [
    { eMin: '0.001', eMax: '0.05', nMin: 100, nMax: 100000, minInE: 20 },
    { eMin: '0.1', eMax: null, nMin: 5000, nMax: 100000, minInE: 50 },
  ],
  III: [
    { eMin: '0.1', eMax: '2', nMin: 100, nMax: 10000, minInE: 20 },
    { eMin: '5', eMax: null, nMin: 500, nMax: 10000, minInE: 20 },
  ],
  IIII: [{ eMin: '5', eMax: null, nMin: 100, nMax: 1000, minInE: 10 }],
};

/** Plausibility limits for laboratory conditions; beyond these an entry is rejected. */
export const ENVIRONMENT_LIMITS = {
  temperature: { min: -50, max: 80, unit: '°C' },
  humidity: { min: 0, max: 100, unit: '%RH' },
  pressure: { min: 500, max: 1100, unit: 'hPa' },
};

/** Default R 76 operating temperature range and reference humidity, used for warnings. */
const R76_TEMPERATURE_RANGE = { min: -10, max: 40 };
const MAX_TEMPERATURE_DRIFT = 5;
const HIGH_HUMIDITY = 85;

function result(errors, warnings, derived = {}) {
  return { valid: Object.keys(errors).length === 0, errors, warnings, derived };
}

function requireText(errors, obj, field, label) {
  if (isBlank(obj?.[field])) {
    errors[field] = `${label} is required`;
    return false;
  }
  return true;
}

function requirePositive(errors, obj, field, label) {
  const v = obj?.[field];
  if (isBlank(v)) errors[field] = `${label} is required`;
  else if (!isFiniteNumber(v)) errors[field] = `${label} must be a number`;
  else if (new Dec(v).lte(0)) errors[field] = `${label} must be greater than zero`;
  else return true;
  return false;
}

export function validateManufacturer(m = {}) {
  const errors = {};
  requireText(errors, m, 'name', 'Manufacturer name');
  requireText(errors, m, 'address', 'Address');
  requireText(errors, m, 'country', 'Country');
  if (!isBlank(m.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)) {
    errors.email = 'Enter a valid email address';
  }
  return result(errors, {});
}

export function validateModel(model = {}) {
  const errors = {};
  requireText(errors, model, 'modelName', 'Model name');
  requireText(errors, model, 'serialNumber', 'Serial number');
  if (!isBlank(model.yearOfManufacture)) {
    const year = Number(model.yearOfManufacture);
    const thisYear = new Date().getFullYear();
    if (!Number.isInteger(year) || year < 1900 || year > thisYear) {
      errors.yearOfManufacture = `Year must be between 1900 and ${thisYear}`;
    }
  }
  return result(errors, {});
}

/**
 * Validates the metrological characteristics of a single-range NAWI.
 * Fields: accuracyClass, unit, maxCapacity, minCapacity, e, d (optional, defaults to e).
 * `derived` exposes n and the minimum Min required so the UI can show them.
 */
export function validateInstrumentSpec(spec = {}) {
  const errors = {};
  const warnings = {};
  const derived = {};

  if (!ACCURACY_CLASSES.includes(spec.accuracyClass)) errors.accuracyClass = 'Select an accuracy class';
  if (!(spec.unit in UNIT_FACTORS)) errors.unit = 'Select a unit';
  requirePositive(errors, spec, 'maxCapacity', 'Maximum capacity (Max)');
  requirePositive(errors, spec, 'minCapacity', 'Minimum capacity (Min)');
  requirePositive(errors, spec, 'e', 'Verification scale interval (e)');
  const hasD = !isBlank(spec.d);
  if (hasD) requirePositive(errors, spec, 'd', 'Actual scale interval (d)');
  if (!isBlank(spec.tareDevice) && !Object.values(TARE_DEVICES).includes(spec.tareDevice)) {
    errors.tareDevice = 'Select a tare device type';
  }
  const hasMaxTare = !isBlank(spec.maxTare);
  if (hasMaxTare) requirePositive(errors, spec, 'maxTare', 'Maximum tare');
  if (Object.keys(errors).length) return result(errors, warnings, derived);

  const max = new Dec(spec.maxCapacity);
  const min = new Dec(spec.minCapacity);
  const e = new Dec(spec.e);
  const d = hasD ? new Dec(spec.d) : e;

  if (min.gte(max)) errors.minCapacity = 'Min must be less than Max';
  if (hasMaxTare && new Dec(spec.maxTare).gt(max)) errors.maxTare = 'Maximum tare cannot exceed Max';
  if (!isPreferredStep(e)) errors.e = 'e must be 1, 2 or 5 × 10ᵏ (e.g. 0.1, 2, 50)';
  if (hasD && !isPreferredStep(d)) errors.d = 'd must be 1, 2 or 5 × 10ᵏ';
  if (e.gte(max)) errors.e = 'e must be smaller than Max';

  // Relationship between e and d (R 76-1, 3.4.2 / 3.4.3)
  if (!errors.d && !errors.e) {
    if (['III', 'IIII'].includes(spec.accuracyClass)) {
      if (!d.eq(e)) errors.d = `For class ${spec.accuracyClass}, d must equal e`;
    } else {
      const ratio = e.div(d);
      if (!(ratio.eq(1) || ratio.eq(10))) errors.d = 'For class I/II, e must equal d or 10·d';
    }
  }

  const n = max.div(e);
  derived.n = n.toString();
  if (!n.isInteger()) warnings.maxCapacity = 'Max is not a whole multiple of e';

  // Class conformity (R 76-1, 3.2 Table 3) — e bounds are defined in grams
  const eGrams = e.mul(UNIT_FACTORS[spec.unit]);
  const rule = CLASS_REQUIREMENTS[spec.accuracyClass].find(
    (r) => eGrams.gte(r.eMin) && (r.eMax === null || eGrams.lte(r.eMax)),
  );
  if (!rule) {
    errors.e ??= `e = ${eGrams} g is outside the range permitted for class ${spec.accuracyClass}`;
  } else {
    derived.nRange = { min: rule.nMin, max: rule.nMax };
    if (n.lt(rule.nMin) || (rule.nMax !== null && n.gt(rule.nMax))) {
      const range = rule.nMax === null ? `at least ${rule.nMin}` : `between ${rule.nMin} and ${rule.nMax}`;
      errors.maxCapacity ??= `n = Max/e = ${n.toDecimalPlaces(2)} must be ${range} for class ${spec.accuracyClass}`;
    }
    const minRequired = e.mul(rule.minInE);
    derived.minRequired = minRequired.toString();
    derived.minInE = rule.minInE;
    if (min.lt(minRequired)) {
      errors.minCapacity ??= `Min must be at least ${rule.minInE}e = ${minRequired} ${spec.unit} for class ${spec.accuracyClass}`;
    }
  }

  return result(errors, warnings, derived);
}

function checkRange(errors, env, field, label, limits) {
  const v = env[field];
  if (isBlank(v)) return null;
  if (!isFiniteNumber(v)) {
    errors[field] = `${label} must be a number`;
    return null;
  }
  const n = Number(v);
  if (n < limits.min || n > limits.max) {
    errors[field] = `${label} must be between ${limits.min} and ${limits.max} ${limits.unit}`;
    return null;
  }
  return n;
}

/**
 * Laboratory conditions at the start and end of testing.
 * Fields: temperatureStart, temperatureEnd, humidityStart, humidityEnd, pressure.
 */
export function validateEnvironment(env = {}) {
  const errors = {};
  const warnings = {};
  const { temperature, humidity, pressure } = ENVIRONMENT_LIMITS;

  for (const f of ['temperatureStart', 'humidityStart', 'pressure']) {
    if (isBlank(env[f])) errors[f] = 'Required';
  }
  const tStart = checkRange(errors, env, 'temperatureStart', 'Temperature', temperature);
  const tEnd = checkRange(errors, env, 'temperatureEnd', 'Temperature', temperature);
  const hStart = checkRange(errors, env, 'humidityStart', 'Humidity', humidity);
  const hEnd = checkRange(errors, env, 'humidityEnd', 'Humidity', humidity);
  checkRange(errors, env, 'pressure', 'Pressure', pressure);

  for (const [field, t] of [['temperatureStart', tStart], ['temperatureEnd', tEnd]]) {
    if (t !== null && (t < R76_TEMPERATURE_RANGE.min || t > R76_TEMPERATURE_RANGE.max)) {
      warnings[field] = `Outside the default R 76 range of ${R76_TEMPERATURE_RANGE.min} to +${R76_TEMPERATURE_RANGE.max} °C`;
    }
  }
  if (tStart !== null && tEnd !== null && Math.abs(tEnd - tStart) > MAX_TEMPERATURE_DRIFT) {
    warnings.temperatureEnd = `Temperature drifted more than ${MAX_TEMPERATURE_DRIFT} °C during the test`;
  }
  for (const [field, h] of [['humidityStart', hStart], ['humidityEnd', hEnd]]) {
    if (h !== null && h > HIGH_HUMIDITY) warnings[field] = `Above ${HIGH_HUMIDITY} %RH — check for condensation`;
  }

  return result(errors, warnings);
}

/** Validates every data-entry section of a test record. */
export function validateRecord(record = {}) {
  const sections = {
    manufacturer: validateManufacturer(record.manufacturer),
    model: validateModel(record.model),
    instrument: validateInstrumentSpec(record.instrument),
    environment: validateEnvironment(record.environment),
  };
  return { valid: Object.values(sections).every((s) => s.valid), sections };
}

import { Dec, isBlank, toDec } from '../math.js';
import { calculateMPE } from '../mpe.js';
import { indicationError } from '../errors.js';
import { ERROR_METHODS, VERIFICATION_TYPES } from '../constants.js';

/** The displayed scale interval d (defaults to e). */
export const displayStep = (spec) => new Dec(isBlank(spec.d) ? spec.e : spec.d);

export const str = (d) => (d === null || d === undefined ? null : d.toString());

export const isFilled = (reading) => !isBlank(reading?.indication);

export function mpeAt(spec, load) {
  return calculateMPE({
    accuracyClass: spec.accuracyClass,
    e: spec.e,
    load,
    verificationType: spec.verificationType || VERIFICATION_TYPES.INITIAL,
  }).mpe;
}

/** Parses a test load. Returns { value } or { error }. */
export function parseLoad(raw, spec, label, { allowZero = false, max } = {}) {
  const L = toDec(raw);
  if (L === null) return { error: `${label}: enter the load` };
  if (L.isNeg() || (!allowZero && L.isZero())) return { error: `${label}: load must be greater than zero` };
  const limit = new Dec(max ?? spec.maxCapacity);
  if (L.gt(limit)) return { error: `${label}: load exceeds ${limit} ${spec.unit}` };
  return { value: L };
}

/**
 * Error for one reading using the selected method.
 * Returns { I, dL, E } or { error }.
 */
export function parseReading(reading = {}, load, spec, method, label) {
  const I = toDec(reading.indication);
  if (I === null) return { error: `${label}: enter the indication` };
  if (method === ERROR_METHODS.DIRECT) return { I, dL: null, E: I.minus(load) };

  const d = displayStep(spec);
  const dL = toDec(reading.additionalLoad);
  if (dL === null) return { error: `${label}: enter ΔL (changepoint method)` };
  if (dL.isNeg() || dL.gt(d)) return { error: `${label}: ΔL must be between 0 and d = ${d}` };
  return { I, dL, E: indicationError({ indication: I, load, additionalLoad: dL, d }) };
}

/**
 * E0 from a reading at or near zero (R 76-1 A.4.4.3, e.g. at 10e). Without a
 * zero reading, E0 is taken as 0 and a warning is raised.
 */
export function zeroCorrection(zero, spec, method, issues, warnings) {
  if (!isFilled(zero)) {
    warnings.push('No zero reading recorded — errors are not corrected for E0');
    return { E0: new Dec(0), row: null };
  }
  const L = parseLoad(isBlank(zero.load) ? '0' : zero.load, spec, 'Zero reading', { allowZero: true });
  if (L.error) {
    issues.push(L.error);
    return { E0: new Dec(0), row: { key: 'zero', invalid: L.error } };
  }
  const r = parseReading(zero, L.value, spec, method, 'Zero reading');
  if (r.error) {
    issues.push(r.error);
    return { E0: new Dec(0), row: { key: 'zero', invalid: r.error } };
  }
  return {
    E0: r.E,
    row: { key: 'zero', load: str(L.value), indication: str(r.I), additionalLoad: str(r.dL), error: str(r.E) },
  };
}

/** Very large errors are almost always typing mistakes, so flag them. */
export function checkPlausible(E, mpe, label, warnings) {
  if (E.abs().gt(mpe.mul(20))) warnings.push(`${label}: error ${E} is over 20× the MPE — check the entry`);
}

export const methodOf = (obs) => obs?.method ?? ERROR_METHODS.CHANGEPOINT;

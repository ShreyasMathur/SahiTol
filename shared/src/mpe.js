import { Dec } from './math.js';
import { VERIFICATION_TYPES } from './constants.js';

/**
 * Maximum permissible errors on initial verification, OIML R 76-1:2006 Table 6.
 * `upToE` is the inclusive upper bound of the load band expressed in multiples
 * of e; `mpeE` is the MPE for that band, also in multiples of e.
 */
export const MPE_BANDS = {
  I: [
    { upToE: 50000, mpeE: '0.5' },
    { upToE: 200000, mpeE: '1' },
    { upToE: Infinity, mpeE: '1.5' },
  ],
  II: [
    { upToE: 5000, mpeE: '0.5' },
    { upToE: 20000, mpeE: '1' },
    { upToE: Infinity, mpeE: '1.5' },
  ],
  III: [
    { upToE: 500, mpeE: '0.5' },
    { upToE: 2000, mpeE: '1' },
    { upToE: Infinity, mpeE: '1.5' },
  ],
  IIII: [
    { upToE: 50, mpeE: '0.5' },
    { upToE: 200, mpeE: '1' },
    { upToE: Infinity, mpeE: '1.5' },
  ],
};

/** MPE in service is twice the MPE on initial verification (R 76-1, 3.5.2). */
export const IN_SERVICE_FACTOR = 2;

function bandsFor(accuracyClass) {
  const bands = MPE_BANDS[accuracyClass];
  if (!bands) throw new RangeError(`Unknown accuracy class: ${accuracyClass}`);
  return bands;
}

function applyVerificationType(mpeE, verificationType) {
  if (verificationType === VERIFICATION_TYPES.INITIAL) return mpeE;
  if (verificationType === VERIFICATION_TYPES.IN_SERVICE) return mpeE.mul(IN_SERVICE_FACTOR);
  throw new RangeError(`Unknown verification type: ${verificationType}`);
}

/**
 * MPE (±) for a given load. `e` and `load` must be in the same unit; the
 * returned `mpe` is in that unit too.
 *
 * @returns {{ mpe: Dec, mpeInE: Dec, loadInE: Dec }}
 */
export function calculateMPE({ accuracyClass, e, load, verificationType = VERIFICATION_TYPES.INITIAL }) {
  const bands = bandsFor(accuracyClass);
  const eD = new Dec(e);
  const m = new Dec(load);
  if (!eD.isFinite() || eD.lte(0)) throw new RangeError('e must be a positive number');
  if (!m.isFinite() || m.isNeg()) throw new RangeError('Load must be zero or positive');

  const loadInE = m.div(eD);
  const band = bands.find((b) => loadInE.lte(b.upToE));
  const mpeInE = applyVerificationType(new Dec(band.mpeE), verificationType);
  return { mpe: mpeInE.mul(eD), mpeInE, loadInE };
}

/**
 * The MPE step schedule from 0 to Max, e.g. for display on the spec form or
 * in the report. Values are returned as strings in the instrument's unit.
 */
export function mpeSchedule({ accuracyClass, e, maxCapacity, verificationType = VERIFICATION_TYPES.INITIAL }) {
  const bands = bandsFor(accuracyClass);
  const eD = new Dec(e);
  const max = new Dec(maxCapacity);
  const rows = [];
  let from = new Dec(0);

  for (const band of bands) {
    const upper = band.upToE === Infinity ? max : Dec.min(max, eD.mul(band.upToE));
    const mpeInE = applyVerificationType(new Dec(band.mpeE), verificationType);
    rows.push({
      from: from.toString(),
      to: upper.toString(),
      mpeInE: mpeInE.toString(),
      mpe: mpeInE.mul(eD).toString(),
    });
    if (upper.gte(max)) break;
    from = upper;
  }
  return rows;
}

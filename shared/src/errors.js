import { Dec } from './math.js';

/**
 * Error of indication before rounding, using the changepoint (additional small
 * weights) method of OIML R 76-1 A.4.4.3:
 *
 *   P = I + ½d − ΔL      (indication before rounding)
 *   E = P − L
 *
 * `d` is the displayed step, which equals e for most instruments.
 *
 * @param {object} p
 * @param {string|number|Dec} p.indication       I  — displayed value
 * @param {string|number|Dec} p.load             L  — applied test load
 * @param {string|number|Dec} [p.additionalLoad] ΔL — small weights added until the display steps up
 * @param {string|number|Dec} p.d                displayed scale interval
 * @returns {Dec} E
 */
export function indicationError({ indication, load, additionalLoad = 0, d }) {
  const P = new Dec(indication).plus(new Dec(d).div(2)).minus(new Dec(additionalLoad));
  return P.minus(new Dec(load));
}

/** Corrected error Ec = E − E0, where E0 is the error at or near zero (A.4.4.3). */
export function correctedError(E, E0) {
  return new Dec(E).minus(new Dec(E0));
}

import Decimal from 'decimal.js';

/**
 * Isolated Decimal constructor for all metrological arithmetic, so the global
 * decimal.js config can't be changed underneath us by other code.
 */
export const Dec = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

/** True when `v` parses to a finite decimal number. */
export function isFiniteNumber(v) {
  if (isBlank(v)) return false;
  try {
    return new Dec(String(v).trim()).isFinite();
  } catch {
    return false;
  }
}

/** Parses to a Dec, or null when the value is blank or not a number. */
export function toDec(v) {
  return isFiniteNumber(v) ? new Dec(String(v).trim()) : null;
}

/** Scale intervals must be of the form 1, 2 or 5 × 10^k (OIML R 76-1, 3.1.2). */
export function isPreferredStep(value) {
  const v = new Dec(value);
  if (!v.isFinite() || v.lte(0)) return false;
  const exponent = Dec.log10(v).floor();
  const mantissa = v.div(new Dec(10).pow(exponent));
  return mantissa.eq(1) || mantissa.eq(2) || mantissa.eq(5);
}

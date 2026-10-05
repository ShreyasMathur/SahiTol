import { Dec } from '../math.js';
import { MPE_BANDS } from '../mpe.js';

/** Rounds down to 2 significant figures and to a whole multiple of e. */
function nice(x, e) {
  const v = new Dec(x).toSignificantDigits(2, Dec.ROUND_DOWN);
  return v.div(e).floor().mul(e);
}

function uniqueSorted(values) {
  const seen = new Map();
  for (const v of values) if (v.gt(0)) seen.set(v.toString(), v);
  return [...seen.values()].sort((a, b) => a.comparedTo(b)).map(String);
}

/**
 * Test loads recommended by OIML R 76-1 Annex A for a valid spec. Loads are
 * strings in the instrument's unit.
 */
export function suggestTestLoads(spec) {
  const max = new Dec(spec.maxCapacity);
  const min = new Dec(spec.minCapacity);
  const e = new Dec(spec.e);

  // A.4.4.1: at least 5 loads including Min, Max and the points where the MPE changes
  const changepoints = MPE_BANDS[spec.accuracyClass]
    .filter((b) => b.upToE !== Infinity)
    .map((b) => e.mul(b.upToE))
    .filter((v) => v.gt(min) && v.lt(max));
  const weighing = [min, ...changepoints, nice(max.div(2), e), max];
  for (const f of ['0.25', '0.75', '0.1']) {
    if (uniqueSorted(weighing).length >= 5) break;
    weighing.push(nice(max.mul(f), e));
  }

  const tare = nice(max.div(3), e);
  const netMax = max.minus(tare);
  const tareNet = [min, ...changepoints.filter((v) => v.lt(netMax)), nice(netMax.div(2), e), netMax];

  return {
    zeroLoad: e.mul(10).lt(min) ? e.mul(10).toString() : '0',
    weighing: uniqueSorted(weighing),
    eccentricity: nice(max.div(3), e).toString(), // A.4.7: about 1/3 of Max
    repeatability: uniqueSorted([nice(max.div(2), e), max]), // A.4.10: ~50 % and near Max
    discrimination: uniqueSorted([min, nice(max.div(2), e), max]), // A.4.8: Min, ½ Max, Max
    tare: { tareLoad: tare.toString(), netLoads: uniqueSorted(tareNet) },
  };
}

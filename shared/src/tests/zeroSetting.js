import { TEST_TYPES } from '../constants.js';
import { Dec, isBlank, toDec } from '../math.js';
import { displayStep, str } from './common.js';
import { finalize, pending } from './result.js';

/**
 * Zero-setting accuracy — OIML R 76-1 4.5.2 / A.4.2.3.
 *
 * After zero-setting, small weights are added until the display changes from
 * zero to one step. With I = 0 and L = 0 the changepoint formula gives
 * E0 = ½d − ΔL, which must be within ±0.25e.
 *
 * Observations: { additionalLoad }
 */
export const zeroSetting = {
  type: TEST_TYPES.ZERO_SETTING,
  label: 'Zero-Setting Accuracy',
  reference: 'OIML R 76-1 4.5.2, A.4.2.3',

  defaults: () => ({ additionalLoad: '' }),

  evaluate(obs = {}, spec) {
    if (isBlank(obs.additionalLoad)) return pending('No observations recorded');
    const issues = [];
    const rows = [];
    const checks = [];
    const d = displayStep(spec);
    const limit = new Dec(spec.e).mul('0.25');
    const dL = toDec(obs.additionalLoad);

    if (dL === null || dL.isNeg() || dL.gt(d)) {
      const error = `ΔL must be between 0 and d = ${d}`;
      issues.push(error);
      rows.push({ key: 'zeroSetting', invalid: error });
    } else {
      const E0 = d.div(2).minus(dL);
      const pass = E0.abs().lte(limit);
      rows.push({ key: 'zeroSetting', additionalLoad: str(dL), error: str(E0), limit: str(limit), pass });
      checks.push(pass);
    }
    return finalize({ rows, issues, checks, summary: { limit: str(limit) } });
  },
};

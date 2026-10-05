import { COMPLIANCE } from '../constants.js';
import { validateInstrumentSpec } from '../validation.js';
import { zeroSetting } from './zeroSetting.js';
import { weighingPerformance } from './weighingPerformance.js';
import { eccentricity } from './eccentricity.js';
import { repeatability } from './repeatability.js';
import { discrimination } from './discrimination.js';
import { tare } from './tare.js';
import { notApplicable, pending } from './result.js';

/** Registry of test modules, in the order they appear in the UI and report. */
export const TEST_MODULES = [zeroSetting, weighingPerformance, eccentricity, repeatability, discrimination, tare];

export const TEST_MODULES_BY_TYPE = Object.fromEntries(TEST_MODULES.map((t) => [t.type, t]));

export function testApplies(module, spec) {
  return !module.applies || module.applies(spec);
}

export function evaluateTest(type, observations, spec = {}) {
  const module = TEST_MODULES_BY_TYPE[type];
  if (!module) throw new RangeError(`Unknown test type: ${type}`);
  if (!validateInstrumentSpec(spec).valid) return pending('Complete the instrument specification first');
  if (!testApplies(module, spec)) return notApplicable('Not applicable to this instrument');
  if (!observations) return pending('No observations recorded');
  try {
    return module.evaluate(observations, spec);
  } catch (err) {
    return { ...pending('Could not evaluate'), issues: [err.message] };
  }
}

/**
 * Overall instrument compliance: FAIL if any test fails, PASS only when every
 * applicable test passes, otherwise PENDING.
 */
export function evaluateCompliance(record) {
  const tests = Object.fromEntries(
    TEST_MODULES.map((t) => [t.type, evaluateTest(t.type, record.tests?.[t.type], record.instrument)]),
  );
  const statuses = Object.values(tests)
    .map((r) => r.status)
    .filter((s) => s !== COMPLIANCE.NOT_APPLICABLE);
  let overall = COMPLIANCE.PENDING;
  if (statuses.includes(COMPLIANCE.FAIL)) overall = COMPLIANCE.FAIL;
  else if (statuses.length && statuses.every((s) => s === COMPLIANCE.PASS)) overall = COMPLIANCE.PASS;
  return { overall, tests };
}

export { ECCENTRICITY_POSITIONS } from './eccentricity.js';
export { suggestTestLoads } from './loads.js';
export { pending, notApplicable, finalize } from './result.js';

import { COMPLIANCE } from './constants.js';
import { validateRecord } from './validation.js';
import { evaluateCompliance, TEST_MODULES_BY_TYPE } from './tests/index.js';
import { checkReferenceWeights } from './weights.js';

const SECTION_LABELS = {
  manufacturer: 'Manufacturer details',
  model: 'Model information',
  instrument: 'Instrument specification',
  environment: 'Test conditions',
};

/**
 * Everything that must be true before a technician can submit a record:
 * valid data-entry sections, a verdict for every applicable test, and
 * adequate, in-date reference weights.
 */
export function submissionReadiness(record, weightSets = []) {
  const issues = [];
  const validation = validateRecord(record);
  for (const [key, section] of Object.entries(validation.sections)) {
    const n = Object.keys(section.errors).length;
    if (n) issues.push(`${SECTION_LABELS[key]}: ${n} field${n === 1 ? '' : 's'} need attention`);
  }

  const evaluation = evaluateCompliance(record);
  for (const [type, result] of Object.entries(evaluation.tests)) {
    if (result.status === COMPLIANCE.PENDING) {
      issues.push(`${TEST_MODULES_BY_TYPE[type].label}: ${result.issues[0] ?? result.notes ?? 'not completed'}`);
    }
  }

  const weights = checkReferenceWeights(record, weightSets);
  issues.push(...weights.issues);

  return { ready: issues.length === 0, issues, validation, evaluation, weights };
}

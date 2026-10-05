import { COMPLIANCE } from '../constants.js';

/**
 * Shape every test evaluator returns:
 * {
 *   status:   'PASS' | 'FAIL' | 'PENDING' | 'NA',
 *   rows:     [{ key, ...computed values as strings, pass }]  // or { key, invalid: message } for a bad entry
 *   issues:   string[]   // blocking: data missing or invalid, so no verdict yet
 *   warnings: string[]   // non-blocking remarks
 *   summary:  object     // test-specific totals (E0, spread, …)
 *   notes:    string
 * }
 */
function base(status, notes, extra = {}) {
  return { status, rows: [], issues: [], warnings: [], summary: {}, notes, ...extra };
}

export function pending(notes) {
  return base(COMPLIANCE.PENDING, notes);
}

export function notApplicable(notes) {
  return base(COMPLIANCE.NOT_APPLICABLE, notes);
}

/**
 * Any failed check is a definitive FAIL, even while other entries are still
 * incomplete. Otherwise a verdict needs at least one check and no open issues.
 */
export function finalize({ rows = [], issues = [], warnings = [], checks = [], summary = {}, notes = '' }) {
  let status = COMPLIANCE.PENDING;
  if (checks.includes(false)) status = COMPLIANCE.FAIL;
  else if (!issues.length && checks.length) status = COMPLIANCE.PASS;
  return { status, rows, issues, warnings, summary, notes };
}

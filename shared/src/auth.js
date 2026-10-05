/**
 * Account rules shared by the browser (live hints) and the server (enforcement).
 */
export const PASSWORD_MIN_LENGTH = 10;
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/i;

/** A short deny-list of passwords that appear at the top of every breach corpus. */
const COMMON = new Set([
  'password', 'password1', 'password12', 'password123', 'passw0rd', '1234567890', '0123456789', '12345678910',
  'qwertyuiop', 'qwerty1234', 'qwerty12345', '1q2w3e4r5t', 'iloveyou12', 'welcome123', 'admin12345', 'administrator',
  'letmein123', 'abcdef1234', 'abc1234567', 'changeme123', 'india12345', 'aaaaaaaaaa', '1111111111',
]);

/**
 * Checks a proposed password. Returns the list of rules it breaks (empty = acceptable)
 * as { id, text, ok } so a form can show a live checklist.
 */
export function passwordChecks(password = '', { username = '', name = '' } = {}) {
  const p = String(password);
  const lower = p.toLowerCase();
  const personal = [username, ...String(name).split(/\s+/)]
    .map((s) => String(s).toLowerCase())
    .filter((s) => s.length >= 3);
  return [
    { id: 'length', text: `At least ${PASSWORD_MIN_LENGTH} characters`, ok: p.length >= PASSWORD_MIN_LENGTH },
    { id: 'mix', text: 'Contains a letter and a digit or symbol', ok: /[a-z]/i.test(p) && /[^a-z]/i.test(p) },
    { id: 'personal', text: 'Does not contain your username or name', ok: !p || !personal.some((s) => lower.includes(s)) },
    { id: 'common', text: 'Is not a commonly used password', ok: !p || !COMMON.has(lower) },
    { id: 'max', text: 'At most 128 characters', ok: p.length <= 128 },
  ];
}

/** First broken rule as a sentence, or null when the password is acceptable. */
export function passwordProblem(password, context) {
  const failed = passwordChecks(password, context).find((c) => !c.ok);
  return failed ? `Password must meet this rule: ${failed.text.toLowerCase()}` : null;
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passwordChecks, passwordProblem } from '../src/index.js';

test('password policy accepts a reasonable passphrase', () => {
  assert.equal(passwordProblem('Balance-Room-42', { username: 'r.sharma', name: 'Riya Sharma' }), null);
});

test('password policy rejects short, letter-only, personal and common passwords', () => {
  assert.match(passwordProblem('Ab1'), /10 characters/);
  assert.match(passwordProblem('onlyletterspassword'), /letter and a digit/);
  assert.match(passwordProblem('riya.sharma2026', { username: 'r.sharma', name: 'Riya Sharma' }), /username or name/);
  assert.match(passwordProblem('Password123'), /commonly used/);
});

test('checklist marks each rule', () => {
  const byId = Object.fromEntries(passwordChecks('abcdefghij').map((c) => [c.id, c.ok]));
  assert.equal(byId.length, true);
  assert.equal(byId.mix, false);
});

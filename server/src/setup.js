import { randomInt, timingSafeEqual } from 'node:crypto';
import { countUsers } from './services/userService.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
let setupCode = null;

/**
 * While no account exists, the first administrator can only be created with a
 * one-time code printed on the server console, so whoever can reach the web page
 * first cannot claim the laboratory. The code changes on every restart.
 */
export function prepareFirstRunSetup() {
  if (countUsers() > 0) {
    setupCode = null;
    return;
  }
  const pick = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  setupCode = process.env.SETUP_CODE || `${pick()}-${pick()}`;
  const line = '─'.repeat(58);
  console.log(`\n${line}\n  FIRST-RUN SETUP\n  No accounts exist yet. Open the web app and create the first\n  administrator using this one-time setup code:\n\n      ${setupCode}\n${line}\n`);
}

export function setupRequired() {
  if (countUsers() > 0) return false;
  // Accounts can disappear while the server runs (e.g. database cleared): issue a code then.
  if (!setupCode) prepareFirstRunSetup();
  return true;
}

export function checkSetupCode(candidate) {
  if (!setupCode) return false;
  const a = Buffer.from(String(candidate ?? '').trim().toUpperCase());
  const b = Buffer.from(setupCode.toUpperCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export function completeSetup() {
  setupCode = null;
}

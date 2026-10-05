import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { ROLES, USERNAME_PATTERN, passwordProblem } from '@nawi/shared';
import { config } from '../config.js';
import { db, now, tx } from '../db.js';
import { HttpError } from '../middleware/errors.js';
import { logAudit } from './auditService.js';
import { randomToken, revokeUserSessions, sha256 } from './sessionService.js';

const BCRYPT_ROUNDS = 12;
const MAX_SIGNATURE_BYTES = 300_000;
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', BCRYPT_ROUNDS);

/** Purposes of one-time links. */
export const LINK = { ACTIVATE: 'activate', RESET: 'reset' };

function statusOf(row) {
  if (!row.active) return 'disabled';
  if (!row.password_hash) return 'pending';
  if (row.locked_until && row.locked_until > now()) return 'locked';
  return 'active';
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role,
    lab: row.lab,
    email: row.email,
    active: Boolean(row.active),
    status: statusOf(row),
    lockedUntil: statusOf(row) === 'locked' ? row.locked_until : null,
    hasSignature: Boolean(row.signature),
    lastLoginAt: row.last_login_at,
    passwordChangedAt: row.password_changed_at,
    createdAt: row.created_at,
  };
}

const getRow = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);

export function getUser(id) {
  return publicUser(getRow(id));
}

export function countUsers() {
  return db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
}

export function listUsers() {
  return db.prepare('SELECT * FROM users ORDER BY active DESC, role, name').all().map(publicUser);
}

function checkPassword(password, row) {
  const problem = passwordProblem(password, { username: row.username, name: row.name });
  if (problem) throw new HttpError(400, problem);
}

function checkFields({ name, role, email }) {
  if (name !== undefined && !String(name).trim()) throw new HttpError(400, 'Full name is required');
  if (role !== undefined && !Object.values(ROLES).includes(role)) throw new HttpError(400, 'Unknown role');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Email address is not valid');
}

function insertUser({ username, name, role, lab, email }, actor) {
  if (!USERNAME_PATTERN.test(username ?? '')) {
    throw new HttpError(400, 'Username must be 3–32 letters, digits, dots, dashes or underscores');
  }
  checkFields({ name: name ?? '', role, email });
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) throw new HttpError(409, 'That username is taken');
  const id = randomUUID();
  const t = now();
  db.prepare(
    `INSERT INTO users (id, username, name, role, lab, email, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, username.trim(), name.trim(), role, lab?.trim() || null, email?.trim() || null, actor?.id ?? null, t, t);
  return id;
}

/** First-run: the laboratory's first administrator, who chooses their own password. */
export function createFirstAdmin({ username, name, lab, email, password }) {
  return tx(() => {
    if (countUsers() > 0) throw new HttpError(409, 'This laboratory is already set up');
    const id = insertUser({ username, name, role: ROLES.ADMIN, lab, email }, null);
    setPassword(id, password);
    const user = getUser(id);
    logAudit(null, user, 'account:setup', { comment: 'First administrator created' });
    return user;
  });
}

/** Admin creates an account with no password; returns it with a one-time activation link token. */
export function createUser(fields, actor) {
  return tx(() => {
    const id = insertUser(fields, actor);
    const user = getUser(id);
    logAudit(null, actor, 'account:created', { comment: `${user.username} (${user.role})` });
    return { user, token: issueLink(id, LINK.ACTIVATE, actor) };
  });
}

const activeAdmins = () => db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1`).get().n;

export function updateUser(id, patch, actor) {
  const row = getRow(id);
  if (!row) throw new HttpError(404, 'User not found');
  checkFields(patch);
  const nextRole = patch.role ?? row.role;
  const nextActive = patch.active === undefined ? Boolean(row.active) : Boolean(patch.active);
  if (actor.id === id && (!nextActive || nextRole !== row.role)) {
    throw new HttpError(400, 'You cannot deactivate yourself or change your own role');
  }
  if (row.role === ROLES.ADMIN && row.active && (nextRole !== ROLES.ADMIN || !nextActive) && activeAdmins() <= 1) {
    throw new HttpError(400, 'At least one active administrator is required');
  }

  tx(() => {
    db.prepare('UPDATE users SET name = ?, role = ?, lab = ?, email = ?, active = ?, updated_at = ? WHERE id = ?').run(
      patch.name?.trim() ?? row.name,
      nextRole,
      patch.lab === undefined ? row.lab : patch.lab?.trim() || null,
      patch.email === undefined ? row.email : patch.email?.trim() || null,
      nextActive ? 1 : 0,
      now(),
      id,
    );
    const notes = [];
    if (nextRole !== row.role) notes.push(`role ${row.role} → ${nextRole}`);
    if (nextActive !== Boolean(row.active)) notes.push(nextActive ? 're-enabled' : 'disabled');
    // Privileges changed or access removed: end existing sessions so they take effect now.
    if (notes.length) revokeUserSessions(id);
    logAudit(null, actor, 'account:updated', { comment: `${row.username}${notes.length ? `: ${notes.join(', ')}` : ''}` });
  });
  return getUser(id);
}

export function unlockUser(id, actor) {
  const row = getRow(id);
  if (!row) throw new HttpError(404, 'User not found');
  db.prepare('UPDATE users SET failed_logins = 0, locked_until = NULL, updated_at = ? WHERE id = ?').run(now(), id);
  logAudit(null, actor, 'account:unlocked', { comment: row.username });
  return getUser(id);
}

/**
 * Issues a one-time activation or password-reset link token. Any earlier unused
 * link for the same user stops working. Only the hash is stored.
 */
export function issueLink(userId, purpose, actor) {
  const row = getRow(userId);
  if (!row) throw new HttpError(404, 'User not found');
  if (!row.active) throw new HttpError(400, 'Enable the account before issuing a link');
  const raw = randomToken();
  const t = new Date();
  db.prepare('UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL').run(t.toISOString(), userId);
  db.prepare(
    `INSERT INTO auth_tokens (token_hash, user_id, purpose, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(sha256(raw), userId, purpose, actor?.id ?? null, t.toISOString(), new Date(t.getTime() + config.linkHours * 3_600_000).toISOString());
  if (purpose === LINK.RESET) logAudit(null, actor, 'account:reset-link', { comment: row.username });
  return raw;
}

function linkRow(raw) {
  const row = db.prepare('SELECT * FROM auth_tokens WHERE token_hash = ?').get(sha256(String(raw ?? '')));
  if (!row || row.used_at || row.expires_at < now()) {
    throw new HttpError(410, 'This link is invalid, already used or expired. Ask your administrator for a new one.');
  }
  const user = getRow(row.user_id);
  if (!user?.active) throw new HttpError(410, 'This account is disabled. Contact your administrator.');
  return { link: row, user };
}

/** What the activation / reset page needs to greet the user. */
export function describeLink(raw) {
  const { link, user } = linkRow(raw);
  return { purpose: link.purpose, username: user.username, name: user.name, expiresAt: link.expires_at };
}

/** Sets the password chosen through a one-time link and consumes the link. */
export function redeemLink(raw, password) {
  const { link, user } = linkRow(raw);
  checkPassword(password, user);
  tx(() => {
    setPassword(user.id, password);
    db.prepare('UPDATE auth_tokens SET used_at = ? WHERE token_hash = ?').run(now(), link.token_hash);
    db.prepare('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?').run(user.id);
    revokeUserSessions(user.id);
    logAudit(null, publicUser(user), link.purpose === LINK.ACTIVATE ? 'account:activated' : 'account:password-reset');
  });
  return getUser(user.id);
}

function setPassword(id, password) {
  checkPassword(password, getRow(id));
  const t = now();
  db.prepare('UPDATE users SET password_hash = ?, password_changed_at = ?, updated_at = ? WHERE id = ?').run(
    bcrypt.hashSync(password, BCRYPT_ROUNDS),
    t,
    t,
    id,
  );
}

/** Changes one's own password; other sessions are signed out. */
export function changeOwnPassword(id, currentPassword, newPassword, keepSessionHash) {
  const row = getRow(id);
  if (!row?.password_hash || !bcrypt.compareSync(currentPassword ?? '', row.password_hash)) {
    throw new HttpError(400, 'Current password is incorrect');
  }
  if (currentPassword === newPassword) throw new HttpError(400, 'Choose a password different from the current one');
  setPassword(id, newPassword);
  revokeUserSessions(id, keepSessionHash);
  logAudit(null, publicUser(row), 'account:password-changed');
}

/**
 * Checks a sign-in attempt. Returns the user, or throws with a message that
 * does not reveal whether an unknown username exists.
 */
export function verifyCredentials(username, password) {
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username ?? '').trim());
  // Compare against a dummy hash when there is no usable hash, to keep timing uniform.
  const ok = bcrypt.compareSync(String(password ?? ''), row?.password_hash ?? DUMMY_HASH) && Boolean(row?.password_hash);
  const t = now();

  if (row?.locked_until && row.locked_until > t) {
    const mins = Math.ceil((Date.parse(row.locked_until) - Date.now()) / 60_000);
    throw new HttpError(423, `Too many failed attempts. This account is locked for ${mins} more minute${mins === 1 ? '' : 's'}, or until an administrator unlocks it.`);
  }
  if (!row || !ok) {
    if (row?.password_hash) {
      const failed = row.failed_logins + 1;
      if (failed >= config.maxFailedLogins) {
        const until = new Date(Date.now() + config.lockoutMinutes * 60_000).toISOString();
        db.prepare('UPDATE users SET failed_logins = 0, locked_until = ? WHERE id = ?').run(until, row.id);
        logAudit(null, publicUser(row), 'account:locked', { comment: `${failed} failed sign-in attempts` });
      } else {
        db.prepare('UPDATE users SET failed_logins = ? WHERE id = ?').run(failed, row.id);
      }
    }
    throw new HttpError(401, 'Incorrect username or password');
  }
  if (!row.active) throw new HttpError(403, 'This account has been disabled. Contact your administrator.');

  db.prepare('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?').run(row.id);
  return recordSignIn(row.id);
}

/** Stamps a successful sign-in (password, setup or one-time link). */
export function recordSignIn(id) {
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now(), id);
  return getUser(id);
}

export function getSignature(id) {
  return getRow(id)?.signature ?? null;
}

export function setSignature(id, dataUrl) {
  if (dataUrl !== null) {
    if (typeof dataUrl !== 'string' || !/^data:image\/(png|jpeg);base64,/.test(dataUrl)) {
      throw new HttpError(400, 'Signature must be a PNG or JPEG image');
    }
    if (dataUrl.length > MAX_SIGNATURE_BYTES) throw new HttpError(413, 'Signature image is too large');
  }
  db.prepare('UPDATE users SET signature = ?, updated_at = ? WHERE id = ?').run(dataUrl, now(), id);
}

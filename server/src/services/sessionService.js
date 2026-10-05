import { createHash, randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { db, now } from '../db.js';

export const SESSION_COOKIE = 'nawi_session';
const TOUCH_EVERY_MS = 60_000;

export const sha256 = (s) => createHash('sha256').update(s).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');

/** Opens a session and returns the raw id for the cookie; only its hash is stored. */
export function createSession(userId, req) {
  const raw = randomToken();
  const t = new Date();
  db.prepare(
    `INSERT INTO sessions (id_hash, user_id, created_at, last_seen_at, expires_at, user_agent, ip) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    sha256(raw),
    userId,
    t.toISOString(),
    t.toISOString(),
    new Date(t.getTime() + config.sessionHours * 3_600_000).toISOString(),
    String(req.get('user-agent') ?? '').slice(0, 200) || null,
    req.ip ?? null,
  );
  return raw;
}

/**
 * Resolves a cookie value to { userId, hash }, or null when the session is unknown,
 * past its absolute lifetime, or idle for longer than the inactivity timeout.
 */
export function resolveSession(raw) {
  if (!raw) return null;
  const hash = sha256(raw);
  const row = db.prepare('SELECT * FROM sessions WHERE id_hash = ?').get(hash);
  if (!row) return null;
  const t = Date.now();
  const idleFor = t - Date.parse(row.last_seen_at);
  if (t > Date.parse(row.expires_at) || idleFor > config.idleMinutes * 60_000) {
    revokeSession(hash);
    return null;
  }
  if (idleFor > TOUCH_EVERY_MS) db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id_hash = ?').run(now(), hash);
  return { userId: row.user_id, hash };
}

export function revokeSession(hash) {
  db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(hash);
}

/** Ends every session of a user, optionally keeping the one making the request. */
export function revokeUserSessions(userId, exceptHash = null) {
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND id_hash IS NOT ?').run(userId, exceptHash);
}

export function listSessions(userId, currentHash) {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now());
  return db
    .prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY last_seen_at DESC')
    .all(userId)
    .map((s) => ({
      // A short, non-secret handle so the UI can revoke a specific session.
      id: s.id_hash.slice(0, 16),
      current: s.id_hash === currentHash,
      createdAt: s.created_at,
      lastSeenAt: s.last_seen_at,
      userAgent: s.user_agent,
      ip: s.ip,
    }));
}

export function revokeSessionByHandle(userId, handle) {
  const row = db
    .prepare('SELECT id_hash FROM sessions WHERE user_id = ? AND substr(id_hash, 1, 16) = ?')
    .get(userId, String(handle ?? ''));
  if (row) revokeSession(row.id_hash);
  return Boolean(row);
}

export function readCookie(req, name) {
  for (const part of (req.get('cookie') ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function setSessionCookie(res, raw) {
  res.cookie(SESSION_COOKIE, raw, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.secureCookies,
    path: '/api',
    maxAge: config.sessionHours * 3_600_000,
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'strict', secure: config.secureCookies, path: '/api' });
}

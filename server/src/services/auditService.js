import { db, now } from '../db.js';

const MAX_CHANGES = 200;

function flatten(value, prefix = '', out = {}) {
  if (value && typeof value === 'object') {
    const entries = Array.isArray(value) ? value.map((v, i) => [i, v]) : Object.entries(value);
    if (!entries.length && prefix) out[prefix] = Array.isArray(value) ? '[]' : '{}';
    for (const [k, v] of entries) flatten(v, prefix ? `${prefix}.${k}` : String(k), out);
  } else if (prefix) {
    out[prefix] = value ?? '';
  }
  return out;
}

/** Field-level differences between two objects, as [{ path, from, to }]. */
export function diff(before = {}, after = {}) {
  const a = flatten(before);
  const b = flatten(after);
  const changes = [];
  for (const path of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const from = a[path] ?? '';
    const to = b[path] ?? '';
    if (String(from) !== String(to)) changes.push({ path, from, to });
  }
  return changes;
}

export function logAudit(recordId, user, action, { changes, comment } = {}) {
  const trimmed = changes?.length > MAX_CHANGES ? [...changes.slice(0, MAX_CHANGES), { path: '…', from: '', to: `${changes.length - MAX_CHANGES} more` }] : changes;
  db.prepare(
    `INSERT INTO audit_log (record_id, user_id, user_name, action, changes, comment, at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(recordId, user?.id ?? null, user?.name ?? 'system', action, trimmed?.length ? JSON.stringify(trimmed) : null, comment ?? null, now());
}

export function listAudit(recordId) {
  return db
    .prepare('SELECT * FROM audit_log WHERE record_id = ? ORDER BY id DESC')
    .all(recordId)
    .map((r) => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      action: r.action,
      changes: r.changes ? JSON.parse(r.changes) : [],
      comment: r.comment,
      at: r.at,
    }));
}

/** Account and sign-in events (not tied to a record), newest first. */
export function listSecurityLog(limit = 100) {
  return db
    .prepare('SELECT * FROM audit_log WHERE record_id IS NULL ORDER BY id DESC LIMIT ?')
    .all(Math.min(Math.max(Number(limit) || 100, 1), 500))
    .map((r) => ({ id: r.id, userId: r.user_id, userName: r.user_name, action: r.action, comment: r.comment, at: r.at }));
}

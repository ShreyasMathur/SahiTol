import { createHash, randomUUID } from 'node:crypto';
import { ATTACHMENT_KINDS } from '@nawi/shared';
import { db, now } from '../db.js';
import { HttpError } from '../middleware/errors.js';

const MAX_BYTES = 3_000_000; // data-URL length; the client downsizes photos before upload
const MAX_PER_RECORD = 12;
const DATA_URL = /^data:(image\/(?:png|jpeg));base64,[A-Za-z0-9+/=]+$/;

function toAttachment(row) {
  return {
    id: row.id,
    recordId: row.record_id,
    kind: row.kind,
    name: row.name,
    mime: row.mime,
    dataUrl: row.data_url,
    caption: row.caption,
    sha256: row.sha256,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function listAttachments(recordId) {
  return db.prepare('SELECT * FROM attachments WHERE record_id = ? ORDER BY created_at').all(recordId).map(toAttachment);
}

export function addAttachment(recordId, { name, caption, dataUrl, kind = ATTACHMENT_KINDS.PHOTO }, user) {
  const match = typeof dataUrl === 'string' && dataUrl.match(DATA_URL);
  if (!match) throw new HttpError(400, 'Photos must be PNG or JPEG images');
  if (dataUrl.length > MAX_BYTES) throw new HttpError(413, 'Photo is too large (max ~2 MB)');
  if (!Object.values(ATTACHMENT_KINDS).includes(kind)) throw new HttpError(400, 'Unknown attachment kind');
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM attachments WHERE record_id = ?').get(recordId);
  if (n >= MAX_PER_RECORD) throw new HttpError(409, `A record can have at most ${MAX_PER_RECORD} photos`);

  const id = randomUUID();
  db.prepare(
    `INSERT INTO attachments (id, record_id, kind, name, mime, data_url, caption, sha256, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, recordId, kind, name ?? null, match[1], dataUrl, caption?.trim() || null, createHash('sha256').update(dataUrl).digest('hex'), user.id, now());
  return toAttachment(db.prepare('SELECT * FROM attachments WHERE id = ?').get(id));
}

export function deleteAttachment(recordId, attachmentId) {
  const row = db.prepare('SELECT * FROM attachments WHERE id = ? AND record_id = ?').get(attachmentId, recordId);
  if (!row) throw new HttpError(404, 'Photo not found');
  db.prepare('DELETE FROM attachments WHERE id = ?').run(attachmentId);
  return toAttachment(row);
}

/** Copies photos onto a new revision so the original's stay untouched. */
export function copyAttachments(fromRecordId, toRecordId) {
  for (const a of listAttachments(fromRecordId)) {
    db.prepare(
      `INSERT INTO attachments (id, record_id, kind, name, mime, data_url, caption, sha256, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(randomUUID(), toRecordId, a.kind, a.name, a.mime, a.dataUrl, a.caption, a.sha256, a.createdBy, a.createdAt);
  }
}

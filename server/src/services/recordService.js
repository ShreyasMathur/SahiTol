import { randomUUID } from 'node:crypto';
import {
  RECORD_STATUS,
  EDITABLE_STATUSES,
  ROLES,
  WORKFLOW,
  TEST_MODULES_BY_TYPE,
  can,
  validateRecord,
  evaluateCompliance,
  submissionReadiness,
} from '@nawi/shared';
import { db, now, tx } from '../db.js';
import { HttpError } from '../middleware/errors.js';
import { diff, logAudit } from './auditService.js';
import { listWeightSets } from './weightService.js';
import { getSignature } from './userService.js';
import { listAttachments, copyAttachments } from './attachmentService.js';
import { computeRecordHash, renderApprovedPdf } from './reportService.js';

const { DRAFT, IN_PROGRESS, SUBMITTED, APPROVED, REJECTED } = RECORD_STATUS;

/** Keys stored in the data JSON column. */
const DATA_KEYS = ['manufacturer', 'model', 'instrument', 'environment', 'tests', 'referenceWeights', 'referenceWeightDetails', 'signatures', 'sample'];
/** Keys a technician edits through the details form. */
const EDITABLE_KEYS = ['manufacturer', 'model', 'instrument', 'environment', 'referenceWeights'];

const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj[k]]));

function rowToRecord(row) {
  if (!row) return null;
  const data = JSON.parse(row.data);
  return {
    id: row.id,
    referenceNo: row.reference_no,
    revision: row.revision,
    revisionOf: row.revision_of,
    supersededBy: row.superseded_by,
    status: row.status,
    compliance: row.compliance,
    createdBy: row.created_by,
    createdByName: row.created_by_name ?? null,
    reviewedBy: row.reviewed_by,
    reviewedByName: row.reviewed_by_name ?? null,
    reviewComment: row.review_comment,
    recordHash: row.record_hash,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tests: {},
    referenceWeights: [],
    signatures: {},
    ...data,
  };
}

const SELECT_RECORD = `
  SELECT r.*, cu.name AS created_by_name, ru.name AS reviewed_by_name
  FROM records r
  LEFT JOIN users cu ON cu.id = r.created_by
  LEFT JOIN users ru ON ru.id = r.reviewed_by`;

export function getRecord(id) {
  const record = rowToRecord(db.prepare(`${SELECT_RECORD} WHERE r.id = ?`).get(id));
  if (!record) throw new HttpError(404, 'Record not found');
  return record;
}

/** Next number in a year's series, e.g. LM/NAWI/2026/0007. Uses the highest issued, so gaps never cause reuse. */
function nextReferenceNo(prefix = 'LM/NAWI') {
  const year = new Date().getFullYear();
  const stem = `${prefix}/${year}/`;
  const { last } = db
    .prepare(`SELECT MAX(CAST(substr(reference_no, ?, 4) AS INTEGER)) AS last FROM records WHERE revision = 0 AND reference_no LIKE ?`)
    .get(stem.length + 1, `${stem}%`);
  return `${stem}${String((last ?? 0) + 1).padStart(4, '0')}`;
}

function persist(id, data, status) {
  db.prepare(
    `UPDATE records SET data = ?, compliance = ?, manufacturer_name = ?, model_name = ?, serial_number = ?,
       accuracy_class = ?, test_date = ?, status = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    JSON.stringify(pick(data, DATA_KEYS)),
    evaluateCompliance(data).overall,
    data.manufacturer?.name || null,
    data.model?.modelName || null,
    data.model?.serialNumber || null,
    data.instrument?.accuracyClass || null,
    data.environment?.testDate || null,
    status,
    now(),
    id,
  );
}

/** Drafts may be incomplete; any other status needs valid data-entry sections. */
function assertValidFor(status, data) {
  if (status === DRAFT) return;
  const validation = validateRecord(data);
  if (!validation.valid) throw new HttpError(422, 'Record has validation errors', validation.sections);
}

export function assertCanEditRecord(record, user) {
  if (!can(user.role, 'record:edit')) throw new HttpError(403, 'Your role cannot edit records');
  if (!EDITABLE_STATUSES.includes(record.status) || record.supersededBy) {
    throw new HttpError(409, `Record is ${record.status.toLowerCase()} and locked — create a revision to correct it`);
  }
  if (user.role !== ROLES.ADMIN && record.createdBy !== user.id) {
    throw new HttpError(403, 'Only the technician who created this record can edit it');
  }
}

function assertWeightIds(ids) {
  if (ids === undefined) return;
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== 'string')) throw new HttpError(400, 'referenceWeights must be a list of ids');
  const known = new Set(listWeightSets().map((w) => w.id));
  const unknown = ids.filter((x) => !known.has(x));
  if (unknown.length) throw new HttpError(400, `Unknown weight set: ${unknown.join(', ')}`);
}

export function createRecord(payload, user, { referencePrefix, sample } = {}) {
  const status = payload.status === IN_PROGRESS ? IN_PROGRESS : DRAFT;
  assertWeightIds(payload.referenceWeights);
  const data = { tests: {}, referenceWeights: [], signatures: {}, ...pick(payload, EDITABLE_KEYS), ...(sample && { sample }) };
  for (const k of EDITABLE_KEYS) if (data[k] === undefined) delete data[k];
  assertValidFor(status, data);

  const id = randomUUID();
  const t = now();
  tx(() => {
    db.prepare(
      `INSERT INTO records (id, reference_no, status, data, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, nextReferenceNo(referencePrefix), status, JSON.stringify(data), user.id, t, t);
    persist(id, data, status);
    logAudit(id, user, 'created', { comment: status === DRAFT ? 'Saved as draft' : undefined });
  });
  return getRecord(id);
}

export function updateRecord(id, payload, user) {
  const record = getRecord(id);
  assertCanEditRecord(record, user);
  assertWeightIds(payload.referenceWeights);

  const before = pick(record, EDITABLE_KEYS);
  const after = { ...before };
  for (const k of EDITABLE_KEYS) if (payload[k] !== undefined) after[k] = payload[k];
  const data = { ...pick(record, DATA_KEYS), ...after };
  // Once testing has started a record stays in process; only drafts can be promoted.
  const status = record.status === DRAFT ? (payload.status === IN_PROGRESS ? IN_PROGRESS : DRAFT) : IN_PROGRESS;
  assertValidFor(status, data);

  tx(() => {
    persist(id, data, status);
    const changes = diff(before, after);
    if (changes.length || status !== record.status) {
      logAudit(id, user, 'updated', { changes, comment: status !== record.status ? `Status ${record.status} → ${status}` : undefined });
    }
  });
  return getRecord(id);
}

export function saveTest(id, type, observations, user) {
  const module = TEST_MODULES_BY_TYPE[type];
  if (!module) throw new HttpError(404, `Unknown test type: ${type}`);
  if (!observations || typeof observations !== 'object' || Array.isArray(observations)) {
    throw new HttpError(400, 'Observations must be an object');
  }
  const record = getRecord(id);
  assertCanEditRecord(record, user);
  if (record.status === DRAFT) {
    throw new HttpError(409, 'Complete the instrument details and choose “Save & continue to tests” first');
  }

  const data = { ...pick(record, DATA_KEYS), tests: { ...record.tests, [type]: observations } };
  tx(() => {
    persist(id, data, IN_PROGRESS);
    const changes = diff(record.tests[type] ?? {}, observations);
    if (changes.length) logAudit(id, user, `test:${type}`, { changes });
  });
  return getRecord(id);
}

function signatureOf(user, signedAt) {
  return { userId: user.id, name: user.name, role: user.role, signedAt, image: getSignature(user.id) };
}

/** Weight sets to judge a record against: the frozen snapshot once submitted, else the live register. */
export function weightSetsFor(record) {
  const frozen = [SUBMITTED, APPROVED].includes(record.status) && record.referenceWeightDetails?.length;
  return frozen ? record.referenceWeightDetails : listWeightSets();
}

export function readinessOf(record) {
  return submissionReadiness(record, weightSetsFor(record));
}

export async function transitionRecord(id, action, user, comment) {
  const step = WORKFLOW[action];
  if (!step) throw new HttpError(400, `Unknown action: ${action}`);
  if (!can(user.role, step.permission)) throw new HttpError(403, `Your role cannot ${action} records`);

  const record = getRecord(id);
  if (record.supersededBy) throw new HttpError(409, 'This record has been superseded by a revision');
  if (!step.from.includes(record.status)) {
    throw new HttpError(409, `Cannot ${action} a record that is ${record.status.toLowerCase()}`);
  }
  const t = now();

  if (action === 'submit') {
    if (user.role !== ROLES.ADMIN && record.createdBy !== user.id) {
      throw new HttpError(403, 'Only the technician who created this record can submit it');
    }
    const readiness = submissionReadiness(record, listWeightSets());
    if (!readiness.ready) throw new HttpError(422, 'Record is not ready to submit', { issues: readiness.issues });

    const data = {
      ...pick(record, DATA_KEYS),
      referenceWeightDetails: readiness.weights.selected, // frozen so later register edits don't alter the report
      signatures: { technician: signatureOf(user, t) },
    };
    tx(() => {
      persist(id, data, SUBMITTED);
      db.prepare('UPDATE records SET submitted_at = ?, reviewed_by = NULL, review_comment = NULL, reviewed_at = NULL WHERE id = ?').run(t, id);
      logAudit(id, user, 'submitted', { comment });
    });
    return getRecord(id);
  }

  // Segregation of duties: nobody reviews their own work.
  if (record.createdBy === user.id) throw new HttpError(403, 'You cannot review a record you created');

  if (action === 'reject') {
    if (!comment?.trim()) throw new HttpError(400, 'A reason is required to reject');
    tx(() => {
      persist(id, pick(record, DATA_KEYS), REJECTED);
      db.prepare('UPDATE records SET reviewed_by = ?, review_comment = ?, reviewed_at = ? WHERE id = ?').run(user.id, comment.trim(), t, id);
      logAudit(id, user, 'rejected', { comment: comment.trim() });
    });
    return getRecord(id);
  }

  // approve
  const readiness = readinessOf(record);
  if (!readiness.ready) throw new HttpError(409, 'Record is no longer complete', { issues: readiness.issues });

  const data = {
    ...pick(record, DATA_KEYS),
    signatures: { ...record.signatures, inspector: signatureOf(user, t) },
  };
  const approved = {
    ...record,
    ...data,
    status: APPROVED,
    reviewedBy: user.id,
    reviewedByName: user.name,
    reviewComment: comment?.trim() || null,
    reviewedAt: t,
  };
  const attachments = listAttachments(id);
  const recordHash = computeRecordHash(approved, attachments);
  const { pdf, pdfSha256 } = await renderApprovedPdf({ ...approved, recordHash }, attachments);

  tx(() => {
    persist(id, data, APPROVED);
    db.prepare('UPDATE records SET reviewed_by = ?, review_comment = ?, reviewed_at = ?, record_hash = ? WHERE id = ?').run(
      user.id,
      approved.reviewComment,
      t,
      recordHash,
      id,
    );
    db.prepare('INSERT OR REPLACE INTO reports (record_id, pdf, pdf_sha256, record_hash, created_at) VALUES (?, ?, ?, ?, ?)').run(
      id,
      pdf,
      pdfSha256,
      recordHash,
      t,
    );
    logAudit(id, user, 'approved', { comment: approved.reviewComment ?? undefined });
  });
  return getRecord(id);
}

/** Corrections after approval: a new revision is opened and the original is marked superseded. */
export function reviseRecord(id, user, reason) {
  if (!can(user.role, 'record:revise')) throw new HttpError(403, 'Your role cannot revise records');
  if (!reason?.trim()) throw new HttpError(400, 'Give a reason for the revision');
  const record = getRecord(id);
  if (record.status !== APPROVED) throw new HttpError(409, 'Only approved records can be revised');
  if (record.supersededBy) throw new HttpError(409, 'A newer revision already exists');

  const revision = record.revision + 1;
  const baseRef = record.referenceNo.replace(/-R\d+$/, '');
  const newId = randomUUID();
  const t = now();
  const data = { ...pick(record, DATA_KEYS), signatures: {}, referenceWeightDetails: undefined };

  tx(() => {
    db.prepare(
      `INSERT INTO records (id, reference_no, revision, revision_of, status, data, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(newId, `${baseRef}-R${revision}`, revision, id, IN_PROGRESS, '{}', user.id, t, t);
    persist(newId, data, IN_PROGRESS);
    copyAttachments(id, newId);
    db.prepare('UPDATE records SET superseded_by = ?, updated_at = ? WHERE id = ?').run(newId, t, id);
    logAudit(id, user, 'superseded', { comment: `Revision ${revision} opened: ${reason.trim()}` });
    logAudit(newId, user, 'revision created', { comment: `Revises ${record.referenceNo}: ${reason.trim()}` });
  });
  return getRecord(newId);
}

/** Whitelisted sort keys for the repository (column → SQL). */
const SORTS = {
  updated: 'r.updated_at',
  reference: 'r.reference_no',
  testDate: 'r.test_date',
  manufacturer: 'r.manufacturer_name',
  status: 'r.status',
  result: 'r.compliance',
};

function listWhere(q) {
  const where = [];
  const params = [];
  if (q.q) {
    where.push('(r.reference_no LIKE ? OR r.manufacturer_name LIKE ? OR r.model_name LIKE ? OR r.serial_number LIKE ?)');
    params.push(...Array(4).fill(`%${q.q}%`));
  }
  if (q.status) {
    const statuses = String(q.status).split(',');
    where.push(`r.status IN (${statuses.map(() => '?').join(',')})`);
    params.push(...statuses);
  }
  for (const [param, column] of [
    ['accuracyClass', 'r.accuracy_class'],
    ['compliance', 'r.compliance'],
    ['manufacturer', 'r.manufacturer_name'],
    ['createdBy', 'r.created_by'],
  ]) {
    if (q[param]) {
      where.push(`${column} = ?`);
      params.push(q[param]);
    }
  }
  if (q.from) {
    where.push('r.test_date >= ?');
    params.push(q.from);
  }
  if (q.to) {
    where.push('r.test_date <= ?');
    params.push(q.to);
  }
  if (q.current === 'true') where.push('r.superseded_by IS NULL');

  const column = SORTS[q.sort] ?? SORTS.updated;
  const dir = q.dir === 'asc' ? 'ASC' : 'DESC';
  return {
    clause: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
    order: `ORDER BY ${column} IS NULL, ${column} ${dir}, r.updated_at DESC`,
  };
}

export function listRecords(q = {}) {
  const { clause, params, order } = listWhere(q);
  const pageSize = Math.min(Math.max(Number(q.pageSize) || 20, 1), 100);
  const page = Math.max(Number(q.page) || 1, 1);
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM records r ${clause}`).get(...params);
  const rows = db
    .prepare(`${SELECT_RECORD} ${clause} ${order} LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize);
  return { total, page, pageSize, items: rows.map(rowToRecord) };
}

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  // Quote everything; neutralise spreadsheet formula injection.
  return `"${(/^([=+@\t\r]|-(?!\d))/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** Every record matching the repository filters, as CSV (no paging). */
export function exportRecordsCsv(q = {}) {
  const { clause, params, order } = listWhere(q);
  const rows = db.prepare(`${SELECT_RECORD} ${clause} ${order} LIMIT 5000`).all(...params).map(rowToRecord);
  const header = [
    'Reference', 'Revision', 'Status', 'Result', 'Manufacturer', 'Model', 'Serial no.', 'Class', 'Max', 'Min', 'e', 'd', 'Unit',
    'Test date', 'Laboratory', 'Created by', 'Reviewed by', 'Submitted at', 'Reviewed at', 'Superseded',
  ];
  const lines = rows.map((r) =>
    [
      r.referenceNo, r.revision, r.status, r.compliance, r.manufacturer?.name, r.model?.modelName, r.model?.serialNumber,
      r.instrument?.accuracyClass, r.instrument?.maxCapacity, r.instrument?.minCapacity, r.instrument?.e, r.instrument?.d || r.instrument?.e,
      r.instrument?.unit, r.environment?.testDate, r.environment?.labName, r.createdByName, r.reviewedByName, r.submittedAt, r.reviewedAt,
      r.supersededBy ? 'yes' : 'no',
    ].map(csvCell).join(','),
  );
  // BOM so Excel opens it as UTF-8.
  return `﻿${[header.map(csvCell).join(','), ...lines].join('\r\n')}\r\n`;
}

export function listManufacturers() {
  return db
    .prepare('SELECT DISTINCT manufacturer_name AS name FROM records WHERE manufacturer_name IS NOT NULL ORDER BY name')
    .all()
    .map((r) => r.name);
}

export function getStats() {
  const byStatus = Object.fromEntries(Object.values(RECORD_STATUS).map((s) => [s, 0]));
  for (const { status, n } of db.prepare('SELECT status, COUNT(*) AS n FROM records GROUP BY status').all()) byStatus[status] = n;

  const outcomes = { PASS: 0, FAIL: 0 };
  for (const { compliance, n } of db
    .prepare(`SELECT compliance, COUNT(*) AS n FROM records WHERE status = 'APPROVED' AND superseded_by IS NULL GROUP BY compliance`)
    .all()) {
    if (compliance in outcomes) outcomes[compliance] = n;
  }
  const decided = outcomes.PASS + outcomes.FAIL;

  const turnaround = db
    .prepare(
      `SELECT AVG((julianday(reviewed_at) - julianday(submitted_at)) * 24) AS hours, COUNT(*) AS n
       FROM records WHERE submitted_at IS NOT NULL AND reviewed_at IS NOT NULL AND status IN ('APPROVED', 'REJECTED')`,
    )
    .get();

  const workload = new Map();
  for (const row of db
    .prepare(
      `SELECT r.created_by AS id, u.name, r.status, COUNT(*) AS n
       FROM records r JOIN users u ON u.id = r.created_by GROUP BY r.created_by, r.status`,
    )
    .all()) {
    const w = workload.get(row.id) ?? { userId: row.id, name: row.name, inProcess: 0, submitted: 0, approved: 0, rejected: 0, total: 0 };
    if ([DRAFT, IN_PROGRESS].includes(row.status)) w.inProcess += row.n;
    if (row.status === SUBMITTED) w.submitted += row.n;
    if (row.status === APPROVED) w.approved += row.n;
    if (row.status === REJECTED) w.rejected += row.n;
    w.total += row.n;
    workload.set(row.id, w);
  }

  // Last 6 calendar months of test dates, split by current outcome.
  const months = [];
  const d = new Date();
  d.setUTCDate(1);
  for (let i = 5; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    months.push({ month: m.toISOString().slice(0, 7), PASS: 0, FAIL: 0, PENDING: 0 });
  }
  const byMonth = new Map(months.map((m) => [m.month, m]));
  for (const row of db
    .prepare(
      `SELECT substr(test_date, 1, 7) AS month, compliance, COUNT(*) AS n FROM records
       WHERE test_date >= ? AND superseded_by IS NULL GROUP BY month, compliance`,
    )
    .all(`${months[0].month}-01`)) {
    const m = byMonth.get(row.month);
    if (m) m[row.compliance in m ? row.compliance : 'PENDING'] += row.n;
  }

  // Reference weight certificates that are expired or due within 30 days.
  const soon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const today = now().slice(0, 10);
  const weightAlerts = listWeightSets({ includeInactive: false })
    .filter((w) => w.dueDate <= soon)
    .map((w) => ({ id: w.id, name: w.name, dueDate: w.dueDate, expired: w.dueDate < today }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return {
    total: Object.values(byStatus).reduce((a, b) => a + b, 0),
    monthly: months,
    weightAlerts,
    setup: {
      weightSets: listWeightSets({ includeInactive: false }).length,
      technicians: db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'technician' AND active = 1 AND password_hash IS NOT NULL`).get().n,
      inspectors: db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'inspector' AND active = 1 AND password_hash IS NOT NULL`).get().n,
    },
    byStatus,
    outcomes: { ...outcomes, passRate: decided ? outcomes.PASS / decided : null },
    turnaround: { averageHours: turnaround.hours, count: turnaround.n },
    workload: [...workload.values()].sort((a, b) => b.total - a.total),
  };
}

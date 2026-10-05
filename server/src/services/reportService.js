import { createHash } from 'node:crypto';
import { RECORD_STATUS, evaluateCompliance } from '@nawi/shared';
import { config } from '../config.js';
import { db } from '../db.js';
import { buildReportModel } from '../reports/model.js';
import { renderPdf } from '../reports/pdf.js';
import { renderDocx } from '../reports/docx.js';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

/** JSON with sorted keys, so the same content always hashes the same. */
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

const signer = (s) => (s ? { userId: s.userId, name: s.name, role: s.role, signedAt: s.signedAt, image: s.image ? sha256(s.image) : null } : null);

/**
 * SHA-256 over everything the approved report states. Printed on the PDF and
 * shown on the public verification page; recomputed there to detect changes.
 */
export function computeRecordHash(record, attachments) {
  return sha256(
    stableStringify({
      referenceNo: record.referenceNo,
      revision: record.revision,
      manufacturer: record.manufacturer,
      model: record.model,
      instrument: record.instrument,
      environment: record.environment,
      tests: record.tests,
      referenceWeights: record.referenceWeightDetails,
      compliance: evaluateCompliance(record).overall,
      reviewComment: record.reviewComment ?? null,
      signatures: { technician: signer(record.signatures?.technician), inspector: signer(record.signatures?.inspector) },
      attachments: attachments.map((a) => ({ sha256: a.sha256, caption: a.caption ?? null })),
    }),
  );
}

const verifyUrl = (record) => `${config.publicUrl}/verify/${record.id}`;

function model(record, attachments, weightSets) {
  return buildReportModel({
    record,
    attachments,
    weightSets,
    draft: record.status !== RECORD_STATUS.APPROVED,
    verifyUrl: verifyUrl(record),
    labName: config.labName,
  });
}

/** Generates the final PDF at approval time; the caller stores it. */
export async function renderApprovedPdf(record, attachments) {
  const pdf = await renderPdf(model(record, attachments, record.referenceWeightDetails ?? []));
  return { pdf, pdfSha256: sha256(pdf) };
}

export function getStoredReport(recordId) {
  const row = db.prepare('SELECT pdf, pdf_sha256, record_hash, created_at FROM reports WHERE record_id = ?').get(recordId);
  return row ? { pdf: Buffer.from(row.pdf), pdfSha256: row.pdf_sha256, recordHash: row.record_hash, createdAt: row.created_at } : null;
}

/** Approved records serve the stored PDF byte-for-byte; others get a watermarked draft. */
export async function reportPdf(record, attachments, weightSets) {
  if (record.status === RECORD_STATUS.APPROVED) {
    const stored = getStoredReport(record.id);
    if (stored) return stored.pdf;
  }
  return renderPdf(model(record, attachments, weightSets));
}

export function reportDocx(record, attachments, weightSets) {
  return renderDocx(model(record, attachments, weightSets));
}

export const reportFileName = (record, ext) => `${record.referenceNo.replace(/[^A-Za-z0-9-]+/g, '_')}.${ext}`;

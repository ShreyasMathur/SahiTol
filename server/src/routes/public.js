import { Router } from 'express';
import { RECORD_STATUS } from '@nawi/shared';
import { getRecord } from '../services/recordService.js';
import { listAttachments } from '../services/attachmentService.js';
import { computeRecordHash, getStoredReport } from '../services/reportService.js';

export const publicRouter = Router();

/**
 * Unauthenticated report verification (target of the QR code). Returns only
 * what is printed on the report, and recomputes the fingerprint to show the
 * stored record hasn't changed since approval.
 */
publicRouter.get('/verify/:id', (req, res) => {
  const record = getRecord(req.params.id);
  const approved = record.status === RECORD_STATUS.APPROVED;
  const stored = getStoredReport(record.id);
  const recomputed = approved ? computeRecordHash(record, listAttachments(record.id)) : null;

  res.json({
    referenceNo: record.referenceNo,
    revision: record.revision,
    status: record.status,
    supersededBy: record.supersededBy ? getRecord(record.supersededBy).referenceNo : null,
    compliance: approved ? record.compliance : null,
    manufacturer: record.manufacturer?.name ?? null,
    model: record.model?.modelName ?? null,
    serialNumber: record.model?.serialNumber ?? null,
    accuracyClass: record.instrument?.accuracyClass ?? null,
    testDate: record.environment?.testDate ?? null,
    approvedAt: approved ? record.reviewedAt : null,
    approvedBy: approved ? record.reviewedByName : null,
    recordHash: record.recordHash,
    pdfSha256: stored?.pdfSha256 ?? null,
    intact: approved ? recomputed === record.recordHash : null,
  });
});

import { Router } from 'express';
import { requirePermission } from '../middleware/auth.js';
import { ah } from '../middleware/errors.js';
import * as records from '../services/recordService.js';
import { addAttachment, deleteAttachment, listAttachments } from '../services/attachmentService.js';
import { listAudit, logAudit } from '../services/auditService.js';
import { getStoredReport, reportDocx, reportFileName, reportPdf } from '../services/reportService.js';

export const recordsRouter = Router();

recordsRouter.get('/', requirePermission('record:view'), (req, res) => res.json(records.listRecords(req.query)));
recordsRouter.get('/export.csv', requirePermission('record:view'), (req, res) => {
  res
    .type('text/csv; charset=utf-8')
    .set('Content-Disposition', `attachment; filename="nawi-records-${new Date().toISOString().slice(0, 10)}.csv"`)
    .send(records.exportRecordsCsv(req.query));
});
recordsRouter.get('/stats', requirePermission('record:view'), (_req, res) => res.json(records.getStats()));
recordsRouter.get('/manufacturers', requirePermission('record:view'), (_req, res) => res.json(records.listManufacturers()));

recordsRouter.get('/:id', requirePermission('record:view'), (req, res) => {
  const record = records.getRecord(req.params.id);
  const { ready, issues, validation, evaluation, weights } = records.readinessOf(record);
  const stored = getStoredReport(record.id);
  const refOf = (id) => (id ? records.getRecord(id).referenceNo : null);
  res.json({
    ...record,
    revisionOfRef: refOf(record.revisionOf),
    supersededByRef: refOf(record.supersededBy),
    readiness: { ready, issues },
    validation,
    evaluation,
    weightsCheck: weights,
    report: stored ? { pdfSha256: stored.pdfSha256, createdAt: stored.createdAt } : null,
  });
});

recordsRouter.post('/', requirePermission('record:create'), (req, res) => {
  res.status(201).json(records.createRecord(req.body ?? {}, req.user));
});

recordsRouter.put('/:id', requirePermission('record:edit'), (req, res) => {
  res.json(records.updateRecord(req.params.id, req.body ?? {}, req.user));
});

recordsRouter.put('/:id/tests/:type', requirePermission('record:edit'), (req, res) => {
  res.json(records.saveTest(req.params.id, req.params.type, req.body?.observations, req.user));
});

recordsRouter.post('/:id/revise', requirePermission('record:revise'), (req, res) => {
  res.status(201).json(records.reviseRecord(req.params.id, req.user, req.body?.reason));
});

recordsRouter.get('/:id/audit', requirePermission('record:view'), (req, res) => {
  records.getRecord(req.params.id);
  res.json(listAudit(req.params.id));
});

// Photographs
recordsRouter.get('/:id/attachments', requirePermission('record:view'), (req, res) => {
  records.getRecord(req.params.id);
  res.json(listAttachments(req.params.id));
});

function editableRecord(req) {
  const record = records.getRecord(req.params.id);
  records.assertCanEditRecord(record, req.user);
  return record;
}

recordsRouter.post('/:id/attachments', requirePermission('record:edit'), (req, res) => {
  editableRecord(req);
  const attachment = addAttachment(req.params.id, req.body ?? {}, req.user);
  logAudit(req.params.id, req.user, 'photo added', { comment: attachment.caption ?? attachment.name ?? undefined });
  res.status(201).json(attachment);
});

recordsRouter.delete('/:id/attachments/:attachmentId', requirePermission('record:edit'), (req, res) => {
  editableRecord(req);
  const removed = deleteAttachment(req.params.id, req.params.attachmentId);
  logAudit(req.params.id, req.user, 'photo removed', { comment: removed.caption ?? removed.name ?? undefined });
  res.status(204).end();
});

// Reports
recordsRouter.get(
  '/:id/report.:format(pdf|docx)',
  requirePermission('report:export'),
  ah(async (req, res) => {
    const record = records.getRecord(req.params.id);
    const attachments = listAttachments(record.id);
    const weightSets = records.weightSetsFor(record);
    const pdf = req.params.format === 'pdf';
    const body = pdf ? await reportPdf(record, attachments, weightSets) : await reportDocx(record, attachments, weightSets);
    res
      .type(pdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      .set('Content-Disposition', `attachment; filename="${reportFileName(record, req.params.format)}"`)
      .send(body);
  }),
);

/** Workflow transitions: submit | approve | reject */
recordsRouter.post(
  '/:id/:action(submit|approve|reject)',
  ah(async (req, res) => {
    res.json(await records.transitionRecord(req.params.id, req.params.action, req.user, req.body?.comment));
  }),
);

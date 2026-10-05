import { RECORD_STATUS, SAMPLE_CERT_PREFIX, SAMPLE_RECORDS, SAMPLE_REFERENCE_PREFIX, sampleRecordData, sampleWeightSets } from '@nawi/shared';
import { db, tx } from '../db.js';
import { logAudit } from './auditService.js';
import { createRecord, saveTest, updateRecord } from './recordService.js';
import { createWeightSet, listWeightSets } from './weightService.js';

const isSampleSet = (w) => w.certificateNo.startsWith(SAMPLE_CERT_PREFIX);

const sampleRecordIds = () =>
  db
    .prepare(`SELECT id FROM records WHERE json_extract(data, '$.sample.key') IS NOT NULL`)
    .all()
    .map((r) => r.id);

export function sampleStatus() {
  return {
    weightSets: listWeightSets().filter(isSampleSet).length,
    records: sampleRecordIds().length,
    available: { weightSets: sampleWeightSets().length, records: SAMPLE_RECORDS.length },
  };
}

/** Adds any sample weight set not already registered. Returns { key → weight set }. */
export function loadSampleWeights(actor) {
  const existing = new Map(listWeightSets().map((w) => [w.certificateNo, w]));
  const byKey = {};
  let added = 0;
  for (const { key, ...w } of sampleWeightSets()) {
    let set = existing.get(w.certificateNo);
    if (!set) {
      set = createWeightSet(w);
      added += 1;
    }
    byKey[key] = set;
  }
  if (added) logAudit(null, actor, 'samples:weights-loaded', { comment: `${added} sample weight set${added === 1 ? '' : 's'}` });
  return { byKey, added };
}

/**
 * Creates the sample records (skipping any already present) with their readings
 * and reference weights, left in process so they can be inspected, submitted and reviewed.
 */
export function loadSampleRecords(actor) {
  const { byKey } = loadSampleWeights(actor);
  const present = new Set(
    db
      .prepare(`SELECT json_extract(data, '$.sample.key') AS key FROM records WHERE json_extract(data, '$.sample.key') IS NOT NULL`)
      .all()
      .map((r) => r.key),
  );
  let added = 0;
  for (const sample of SAMPLE_RECORDS) {
    if (present.has(sample.key)) continue;
    const { tests, sample: meta, ...sections } = sampleRecordData(sample);
    const record = createRecord({ ...sections, status: RECORD_STATUS.IN_PROGRESS }, actor, {
      referencePrefix: SAMPLE_REFERENCE_PREFIX,
      sample: meta,
    });
    updateRecord(record.id, { referenceWeights: sample.weights.map((k) => byKey[k].id) }, actor);
    for (const [type, observations] of Object.entries(tests)) saveTest(record.id, type, observations, actor);
    added += 1;
  }
  if (added) logAudit(null, actor, 'samples:records-loaded', { comment: `${added} sample record${added === 1 ? '' : 's'}` });
  return { added };
}

/**
 * Deletes every sample record (with its revisions, photos, reports and history)
 * and every sample weight set that no remaining record uses.
 */
export function removeSamples(actor) {
  const ids = sampleRecordIds();
  const result = tx(() => {
    if (ids.length) {
      const list = ids.map(() => '?').join(',');
      db.prepare(`UPDATE records SET superseded_by = NULL, revision_of = NULL WHERE id IN (${list})`).run(...ids);
      for (const table of ['reports', 'attachments', 'audit_log']) {
        db.prepare(`DELETE FROM ${table} WHERE record_id IN (${list})`).run(...ids);
      }
      db.prepare(`DELETE FROM records WHERE id IN (${list})`).run(...ids);
    }

    let setsRemoved = 0;
    let setsKept = 0;
    for (const set of listWeightSets().filter(isSampleSet)) {
      const inUse = db.prepare(`SELECT 1 FROM records WHERE data LIKE ? LIMIT 1`).get(`%${set.id}%`);
      if (inUse) {
        setsKept += 1;
        continue;
      }
      db.prepare('DELETE FROM weight_sets WHERE id = ?').run(set.id);
      setsRemoved += 1;
    }
    return { recordsRemoved: ids.length, setsRemoved, setsKept };
  });
  logAudit(null, actor, 'samples:removed', {
    comment: `${result.recordsRemoved} records, ${result.setsRemoved} weight sets${result.setsKept ? ` (${result.setsKept} kept: used by real records)` : ''}`,
  });
  return result;
}

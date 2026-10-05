import { randomUUID } from 'node:crypto';
import { validateWeightSet } from '@nawi/shared';
import { db, now } from '../db.js';
import { HttpError } from '../middleware/errors.js';

function toWeightSet(row) {
  return {
    id: row.id,
    name: row.name,
    class: row.class,
    minNominal: row.min_nominal,
    maxNominal: row.max_nominal,
    certificateNo: row.certificate_no,
    calibrationLab: row.calibration_lab,
    calibratedOn: row.calibrated_on,
    dueDate: row.due_date,
    active: Boolean(row.active),
  };
}

export function listWeightSets({ includeInactive = true } = {}) {
  const where = includeInactive ? '' : 'WHERE active = 1';
  return db.prepare(`SELECT * FROM weight_sets ${where} ORDER BY name`).all().map(toWeightSet);
}

export function getWeightSet(id) {
  const row = db.prepare('SELECT * FROM weight_sets WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, 'Weight set not found');
  return toWeightSet(row);
}

function assertValid(w) {
  const v = validateWeightSet(w);
  if (!v.valid) throw new HttpError(422, 'Weight set has validation errors', v.errors);
}

export function createWeightSet(w) {
  assertValid(w);
  const id = randomUUID();
  const t = now();
  db.prepare(
    `INSERT INTO weight_sets (id, name, class, min_nominal, max_nominal, certificate_no, calibration_lab, calibrated_on, due_date, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, w.name.trim(), w.class, w.minNominal, w.maxNominal, w.certificateNo.trim(), w.calibrationLab ?? null, w.calibratedOn || null, w.dueDate, w.active === false ? 0 : 1, t, t);
  return getWeightSet(id);
}

export function updateWeightSet(id, patch) {
  const merged = { ...getWeightSet(id), ...patch };
  assertValid(merged);
  db.prepare(
    `UPDATE weight_sets SET name = ?, class = ?, min_nominal = ?, max_nominal = ?, certificate_no = ?, calibration_lab = ?,
       calibrated_on = ?, due_date = ?, active = ?, updated_at = ? WHERE id = ?`,
  ).run(merged.name.trim(), merged.class, merged.minNominal, merged.maxNominal, merged.certificateNo.trim(), merged.calibrationLab ?? null, merged.calibratedOn || null, merged.dueDate, merged.active ? 1 : 0, now(), id);
  return getWeightSet(id);
}

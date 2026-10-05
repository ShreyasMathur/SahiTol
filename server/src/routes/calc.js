import { Router } from 'express';
import { calculateMPE, mpeSchedule, validateInstrumentSpec } from '@nawi/shared';
import { HttpError } from '../middleware/errors.js';

/**
 * Stateless calculation endpoints. The client runs the same shared engine for
 * live feedback; these exist for integrations and server-side verification.
 */
export const calcRouter = Router();

calcRouter.post('/mpe', (req, res) => {
  const { accuracyClass, e, load, verificationType } = req.body ?? {};
  try {
    const r = calculateMPE({ accuracyClass, e, load, verificationType });
    res.json({ mpe: r.mpe.toString(), mpeInE: r.mpeInE.toString(), loadInE: r.loadInE.toString() });
  } catch (err) {
    throw new HttpError(400, err.message);
  }
});

calcRouter.post('/spec', (req, res) => {
  const spec = req.body ?? {};
  const validation = validateInstrumentSpec(spec);
  const schedule = validation.valid ? mpeSchedule(spec) : null;
  res.json({ ...validation, schedule });
});

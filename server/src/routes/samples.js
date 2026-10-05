import { Router } from 'express';
import { requirePermission } from '../middleware/auth.js';
import { loadSampleRecords, loadSampleWeights, removeSamples, sampleStatus } from '../services/sampleService.js';

/** Optional sample data for trying out the system; administrators only. */
export const samplesRouter = Router();

samplesRouter.use(requirePermission('users:manage'));

samplesRouter.get('/', (_req, res) => res.json(sampleStatus()));
samplesRouter.post('/weights', (req, res) => res.json({ added: loadSampleWeights(req.user).added, status: sampleStatus() }));
samplesRouter.post('/records', (req, res) => res.json({ ...loadSampleRecords(req.user), status: sampleStatus() }));
samplesRouter.delete('/', (req, res) => res.json({ ...removeSamples(req.user), status: sampleStatus() }));

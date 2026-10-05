import { Router } from 'express';
import { requirePermission } from '../middleware/auth.js';
import { createWeightSet, listWeightSets, updateWeightSet } from '../services/weightService.js';

export const weightsRouter = Router();

weightsRouter.get('/', requirePermission('weights:view'), (_req, res) => res.json(listWeightSets()));
weightsRouter.post('/', requirePermission('weights:manage'), (req, res) => res.status(201).json(createWeightSet(req.body ?? {})));
weightsRouter.put('/:id', requirePermission('weights:manage'), (req, res) => res.json(updateWeightSet(req.params.id, req.body ?? {})));

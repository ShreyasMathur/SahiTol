import { Router } from 'express';
import { config } from '../config.js';
import { requirePermission } from '../middleware/auth.js';
import { listSecurityLog } from '../services/auditService.js';
import { LINK, createUser, getUser, issueLink, listUsers, unlockUser, updateUser } from '../services/userService.js';

export const usersRouter = Router();

usersRouter.use(requirePermission('users:manage'));

const linkUrl = (token) => `${config.publicUrl}/activate/${token}`;

usersRouter.get('/', (_req, res) => res.json(listUsers()));
usersRouter.get('/security-log', (req, res) => res.json(listSecurityLog(req.query.limit)));

/** New accounts get no password: the admin hands the person a one-time activation link. */
usersRouter.post('/', (req, res) => {
  const { user, token } = createUser(req.body ?? {}, req.user);
  res.status(201).json({ user, link: { url: linkUrl(token), purpose: LINK.ACTIVATE, expiresInHours: config.linkHours } });
});

usersRouter.put('/:id', (req, res) => res.json(updateUser(req.params.id, req.body ?? {}, req.user)));

/** Activation link for a pending account, otherwise a password-reset link. */
usersRouter.post('/:id/link', (req, res) => {
  const user = getUser(req.params.id);
  const purpose = user?.status === 'pending' ? LINK.ACTIVATE : LINK.RESET;
  const token = issueLink(req.params.id, purpose, req.user);
  res.json({ url: linkUrl(token), purpose, expiresInHours: config.linkHours });
});

usersRouter.post('/:id/unlock', (req, res) => res.json(unlockUser(req.params.id, req.user)));

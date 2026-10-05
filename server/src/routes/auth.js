import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { logAudit } from '../services/auditService.js';
import {
  changeOwnPassword,
  createFirstAdmin,
  describeLink,
  getSignature,
  getUser,
  recordSignIn,
  redeemLink,
  setSignature,
  verifyCredentials,
} from '../services/userService.js';
import {
  SESSION_COOKIE,
  clearSessionCookie,
  createSession,
  listSessions,
  readCookie,
  resolveSession,
  revokeSession,
  revokeSessionByHandle,
  revokeUserSessions,
  setSessionCookie,
} from '../services/sessionService.js';
import { checkSetupCode, completeSetup, setupRequired } from '../setup.js';

export const authRouter = Router();

const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 30;

/** Per-IP throttle across all usernames; per-account lockout is enforced in the user service. */
function throttle(req, bucket) {
  const key = `${bucket}|${req.ip}`;
  const t = Date.now();
  const recent = (attempts.get(key) ?? []).filter((x) => t - x < WINDOW_MS);
  if (recent.length >= MAX_PER_IP) throw new HttpError(429, 'Too many attempts from this network — try again in 15 minutes');
  recent.push(t);
  attempts.set(key, recent);
}

function signIn(req, res, user) {
  setSessionCookie(res, createSession(user.id, req));
  res.json(recordSignIn(user.id));
}

authRouter.get('/status', (_req, res) => res.json({ setupRequired: setupRequired() }));

/** First-run: create the first administrator with the code printed on the server console. */
authRouter.post('/setup', (req, res) => {
  throttle(req, 'setup');
  if (!setupRequired()) throw new HttpError(409, 'This laboratory is already set up — sign in instead');
  const { setupCode, ...fields } = req.body ?? {};
  if (!checkSetupCode(setupCode)) throw new HttpError(403, 'Setup code is incorrect. It is printed in the server console.');
  const user = createFirstAdmin(fields);
  completeSetup();
  signIn(req, res, user);
});

authRouter.post('/login', (req, res) => {
  throttle(req, 'login');
  const { username, password } = req.body ?? {};
  let user;
  try {
    user = verifyCredentials(username, password);
  } catch (err) {
    logAudit(null, null, 'auth:sign-in-failed', { comment: `${String(username ?? '').slice(0, 40)} from ${req.ip} — ${err.message}` });
    throw err;
  }
  logAudit(null, user, 'auth:signed-in', { comment: `from ${req.ip}` });
  signIn(req, res, user);
});

authRouter.post('/logout', (req, res) => {
  // Works even when the session has already expired.
  const session = resolveSession(readCookie(req, SESSION_COOKIE));
  if (session) revokeSession(session.hash);
  clearSessionCookie(res);
  res.status(204).end();
});

// One-time activation / password-reset links
authRouter.get('/links/:token', (req, res) => {
  throttle(req, 'link');
  res.json(describeLink(req.params.token));
});

authRouter.post('/links/:token', (req, res) => {
  throttle(req, 'link');
  const user = redeemLink(req.params.token, req.body?.password);
  signIn(req, res, user);
});

// Signed-in user
authRouter.get('/me', authenticate, (req, res) => res.json(req.user));

authRouter.put('/me/password', authenticate, (req, res) => {
  changeOwnPassword(req.user.id, req.body?.currentPassword, req.body?.newPassword, req.sessionHash);
  res.status(204).end();
});

authRouter.get('/me/sessions', authenticate, (req, res) => res.json(listSessions(req.user.id, req.sessionHash)));

authRouter.post('/me/sessions/revoke-others', authenticate, (req, res) => {
  revokeUserSessions(req.user.id, req.sessionHash);
  logAudit(null, req.user, 'auth:signed-out-others');
  res.status(204).end();
});

authRouter.delete('/me/sessions/:handle', authenticate, (req, res) => {
  if (!revokeSessionByHandle(req.user.id, req.params.handle)) throw new HttpError(404, 'Session not found');
  res.status(204).end();
});

authRouter.get('/me/signature', authenticate, (req, res) => res.json({ dataUrl: getSignature(req.user.id) }));

authRouter.put('/me/signature', authenticate, (req, res) => {
  setSignature(req.user.id, req.body?.dataUrl ?? null);
  res.json(getUser(req.user.id));
});

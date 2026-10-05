import { can } from '@nawi/shared';
import { getUser } from '../services/userService.js';
import { SESSION_COOKIE, readCookie, resolveSession } from '../services/sessionService.js';
import { HttpError } from './errors.js';

/** Loads the signed-in user from the session cookie; the user row is read fresh on every request. */
export function authenticate(req, _res, next) {
  const session = resolveSession(readCookie(req, SESSION_COOKIE));
  if (!session) return next(new HttpError(401, 'Your session has ended — please sign in again'));
  const user = getUser(session.userId);
  if (!user?.active) return next(new HttpError(401, 'This account has been disabled'));
  req.user = user;
  req.sessionHash = session.hash;
  next();
}

/**
 * CSRF defence in depth (the cookie is already SameSite=Strict): state-changing
 * requests must carry a custom header, which a cross-site form cannot send.
 */
export function requireAppHeader(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.get('x-requested-with') === 'nawi') return next();
  next(new HttpError(403, 'Request rejected'));
}

export function requirePermission(permission) {
  return (req, _res, next) => {
    if (!can(req.user?.role, permission)) {
      return next(new HttpError(403, `Your role (${req.user?.role}) cannot perform ${permission}`));
    }
    next();
  };
}

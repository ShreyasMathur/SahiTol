import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  port: Number(process.env.PORT ?? 4000),
  dbFile: process.env.DB_FILE ?? path.join(root, 'data', 'nawi.db'),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  /** Base URL of the web app, used for QR-code verification links in reports. */
  publicUrl: (process.env.PUBLIC_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
  /** Absolute session lifetime (hours) and inactivity timeout (minutes). */
  sessionHours: Number(process.env.SESSION_HOURS ?? 10),
  idleMinutes: Number(process.env.SESSION_IDLE_MINUTES ?? 60),
  /** Send the session cookie only over HTTPS. On by default in production. */
  secureCookies: (process.env.SECURE_COOKIES ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false')) === 'true',
  /** Lifetime of activation / password-reset links, in hours. */
  linkHours: Number(process.env.LINK_HOURS ?? 72),
  maxFailedLogins: 5,
  lockoutMinutes: 15,
  labName: process.env.LAB_NAME ?? 'Legal Metrology Laboratory',
};

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

const SCHEMA_VERSION = 3;

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });

export const db = new DatabaseSync(config.dbFile);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

const TABLES = ['sessions', 'auth_tokens', 'reports', 'audit_log', 'attachments', 'records', 'weight_sets', 'users'];

// Prototype migration strategy: rebuild on schema change. Existing data is discarded, so
// only change SCHEMA_VERSION before a laboratory starts using the system for real.
const { user_version: version } = db.prepare('PRAGMA user_version').get();
if (version !== SCHEMA_VERSION) {
  if (version !== 0) console.warn(`Schema v${version} → v${SCHEMA_VERSION}: rebuilding database`);
  for (const t of TABLES) db.exec(`DROP TABLE IF EXISTS ${t}`);
  db.exec(`
    CREATE TABLE users (
      id            TEXT PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name          TEXT NOT NULL,
      role          TEXT NOT NULL,
      lab           TEXT,
      email         TEXT,
      -- NULL until the user activates the account and chooses a password
      password_hash TEXT,
      active        INTEGER NOT NULL DEFAULT 1,
      signature     TEXT,
      failed_logins INTEGER NOT NULL DEFAULT 0,
      locked_until  TEXT,
      last_login_at TEXT,
      password_changed_at TEXT,
      created_by    TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    -- Server-side sessions; the browser holds only a random id in an httpOnly cookie.
    CREATE TABLE sessions (
      id_hash      TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL REFERENCES users(id),
      created_at   TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      expires_at   TEXT NOT NULL,
      user_agent   TEXT,
      ip           TEXT
    );
    CREATE INDEX idx_sessions_user ON sessions(user_id);

    -- One-time links for account activation and password reset (stored hashed).
    CREATE TABLE auth_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id),
      purpose    TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at    TEXT
    );

    CREATE TABLE weight_sets (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      class           TEXT NOT NULL,
      min_nominal     TEXT NOT NULL,
      max_nominal     TEXT NOT NULL,
      certificate_no  TEXT NOT NULL,
      calibration_lab TEXT,
      calibrated_on   TEXT,
      due_date        TEXT NOT NULL,
      active          INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );

    CREATE TABLE records (
      id                TEXT PRIMARY KEY,
      reference_no      TEXT NOT NULL UNIQUE,
      revision          INTEGER NOT NULL DEFAULT 0,
      revision_of       TEXT REFERENCES records(id),
      superseded_by     TEXT REFERENCES records(id),
      status            TEXT NOT NULL,
      compliance        TEXT NOT NULL DEFAULT 'PENDING',
      -- denormalised for search/filter; the full record lives in data
      manufacturer_name TEXT,
      model_name        TEXT,
      serial_number     TEXT,
      accuracy_class    TEXT,
      test_date         TEXT,
      data              TEXT NOT NULL,
      created_by        TEXT NOT NULL REFERENCES users(id),
      reviewed_by       TEXT REFERENCES users(id),
      review_comment    TEXT,
      record_hash       TEXT,
      submitted_at      TEXT,
      reviewed_at       TEXT,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL
    );
    CREATE INDEX idx_records_status ON records(status);
    CREATE INDEX idx_records_updated ON records(updated_at DESC);
    CREATE INDEX idx_records_test_date ON records(test_date);

    CREATE TABLE attachments (
      id         TEXT PRIMARY KEY,
      record_id  TEXT NOT NULL REFERENCES records(id),
      kind       TEXT NOT NULL,
      name       TEXT,
      mime       TEXT NOT NULL,
      data_url   TEXT NOT NULL,
      caption    TEXT,
      sha256     TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX idx_attachments_record ON attachments(record_id);

    CREATE TABLE audit_log (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id TEXT,
      user_id   TEXT,
      user_name TEXT,
      action    TEXT NOT NULL,
      changes   TEXT,
      comment   TEXT,
      at        TEXT NOT NULL
    );
    CREATE INDEX idx_audit_record ON audit_log(record_id, id);

    -- The approved PDF is stored once and served unchanged afterwards.
    CREATE TABLE reports (
      record_id   TEXT PRIMARY KEY REFERENCES records(id),
      pdf         BLOB NOT NULL,
      pdf_sha256  TEXT NOT NULL,
      record_hash TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );

    PRAGMA user_version = ${SCHEMA_VERSION};
  `);
}

/** Runs `fn` in a transaction. */
export function tx(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export const now = () => new Date().toISOString();

import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (db) return db

  const dbPath = path.join(app.getPath('userData'), 'ssh-app.db')
  const dbDir = path.dirname(dbPath)

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  initSchema(db)
  return db
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hosts (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      group_name  TEXT DEFAULT 'Default',
      host        TEXT NOT NULL,
      port        INTEGER DEFAULT 22,
      username    TEXT NOT NULL,
      auth_type   TEXT NOT NULL CHECK(auth_type IN ('password', 'key', 'key_passphrase')),
      password_enc TEXT,
      key_path    TEXT,
      passphrase_enc TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      last_used   TEXT
    );

    CREATE TABLE IF NOT EXISTS snippets (
      id      TEXT PRIMARY KEY,
      name    TEXT NOT NULL,
      command TEXT NOT NULL,
      tag     TEXT
    );

    CREATE TABLE IF NOT EXISTS known_hosts (
      host        TEXT NOT NULL,
      port        INTEGER NOT NULL,
      fingerprint TEXT NOT NULL,
      added_at    TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (host, port)
    );
  `)
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

import { getDatabase } from './database'
import type { KnownHost } from '../../src/types'

export function getKnownHost(host: string, port: number): KnownHost | undefined {
  const db = getDatabase()
  return db.prepare('SELECT * FROM known_hosts WHERE host = ? AND port = ?').get(host, port) as KnownHost | undefined
}

export function addKnownHost(host: string, port: number, fingerprint: string): void {
  const db = getDatabase()
  db.prepare(`
    INSERT OR REPLACE INTO known_hosts (host, port, fingerprint, added_at)
    VALUES (?, ?, ?, datetime('now'))
  `).run(host, port, fingerprint)
}

export function removeKnownHost(host: string, port: number): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM known_hosts WHERE host = ? AND port = ?').run(host, port)
  return result.changes > 0
}

export function getAllKnownHosts(): KnownHost[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM known_hosts ORDER BY host').all() as KnownHost[]
}

export function updateFingerprint(host: string, port: number, fingerprint: string): void {
  const db = getDatabase()
  db.prepare(`
    UPDATE known_hosts SET fingerprint = ?, added_at = datetime('now')
    WHERE host = ? AND port = ?
  `).run(fingerprint, host, port)
}

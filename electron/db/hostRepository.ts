import { randomUUID } from 'crypto'
import { getDatabase } from './database'
import type { Host } from '../../src/types'

export function getAllHosts(): Host[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM hosts ORDER BY group_name, name').all() as Host[]
}

export function getHostById(id: string): Host | undefined {
  const db = getDatabase()
  return db.prepare('SELECT * FROM hosts WHERE id = ?').get(id) as Host | undefined
}

export function createHost(host: Omit<Host, 'id' | 'created_at' | 'last_used'>): Host {
  const db = getDatabase()
  const id = randomUUID()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO hosts (id, name, group_name, host, port, username, auth_type, password_enc, key_path, passphrase_enc, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, host.name, host.group_name, host.host, host.port, host.username, host.auth_type, host.password_enc || null, host.key_path || null, host.passphrase_enc || null, now)

  return getHostById(id)!
}

export function updateHost(id: string, host: Partial<Omit<Host, 'id' | 'created_at'>>): Host | undefined {
  const db = getDatabase()
  const existing = getHostById(id)
  if (!existing) return undefined

  const fields = ['name', 'group_name', 'host', 'port', 'username', 'auth_type', 'password_enc', 'key_path', 'passphrase_enc']
  const updates: string[] = []
  const values: any[] = []

  for (const field of fields) {
    if (field in host) {
      updates.push(`${field} = ?`)
      values.push((host as any)[field])
    }
  }

  if (updates.length > 0) {
    values.push(id)
    db.prepare(`UPDATE hosts SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  }

  return getHostById(id)
}

export function deleteHost(id: string): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM hosts WHERE id = ?').run(id)
  return result.changes > 0
}

export function updateLastUsed(id: string): void {
  const db = getDatabase()
  db.prepare("UPDATE hosts SET last_used = datetime('now') WHERE id = ?").run(id)
}

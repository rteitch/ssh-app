import { randomUUID } from 'crypto'
import { getDatabase } from './database'
import type { Snippet } from '../../src/types'

export function getAllSnippets(): Snippet[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM snippets ORDER BY tag, name').all() as Snippet[]
}

export function getSnippetById(id: string): Snippet | undefined {
  const db = getDatabase()
  return db.prepare('SELECT * FROM snippets WHERE id = ?').get(id) as Snippet | undefined
}

export function createSnippet(snippet: Omit<Snippet, 'id'>): Snippet {
  const db = getDatabase()
  const id = randomUUID()

  db.prepare('INSERT INTO snippets (id, name, command, tag) VALUES (?, ?, ?, ?)').run(
    id, snippet.name, snippet.command, snippet.tag || null
  )

  return { id, ...snippet }
}

export function updateSnippet(id: string, snippet: Partial<Omit<Snippet, 'id'>>): Snippet | undefined {
  const db = getDatabase()
  const existing = getSnippetById(id)
  if (!existing) return undefined

  const fields = ['name', 'command', 'tag']
  const updates: string[] = []
  const values: any[] = []

  for (const field of fields) {
    if (field in snippet) {
      updates.push(`${field} = ?`)
      values.push((snippet as any)[field])
    }
  }

  if (updates.length > 0) {
    values.push(id)
    db.prepare(`UPDATE snippets SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  }

  return getSnippetById(id)
}

export function deleteSnippet(id: string): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM snippets WHERE id = ?').run(id)
  return result.changes > 0
}

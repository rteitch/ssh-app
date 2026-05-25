import type { SFTPWrapper } from 'ssh2'
import path from 'path'
import { getSession } from './sshManager'
import type { SFTPFile } from '../../src/types'

const sftpSessions = new Map<string, SFTPWrapper>()

interface ActiveTransfer {
  cancelled: boolean
  sessionId: string
}
const activeTransfers = new Map<string, ActiveTransfer>()

export async function getSFTP(sessionId: string): Promise<SFTPWrapper> {
  if (sftpSessions.has(sessionId)) {
    return sftpSessions.get(sessionId)!
  }

  const session = getSession(sessionId)
  if (!session || !session.connected) {
    throw new Error('SSH session not connected')
  }

  return new Promise((resolve, reject) => {
    session.client.sftp((err, sftp) => {
      if (err) {
        reject(err)
        return
      }
      sftpSessions.set(sessionId, sftp)
      resolve(sftp)
    })
  })
}

export async function listDirectory(sessionId: string, remotePath: string): Promise<SFTPFile[]> {
  const sftp = await getSFTP(sessionId)

  return new Promise((resolve, reject) => {
    sftp.readdir(remotePath, (err, list) => {
      if (err) {
        reject(err)
        return
      }

      const files: SFTPFile[] = list.map(item => ({
        filename: item.filename,
        longname: item.longname,
        attrs: {
          size: item.attrs.size,
          mode: item.attrs.mode,
          atime: item.attrs.atime,
          mtime: item.attrs.mtime,
          uid: item.attrs.uid,
          gid: item.attrs.gid
        },
        isDirectory: (item.attrs.mode & 0o170000) === 0o040000
      }))

      files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.filename.localeCompare(b.filename)
      })

      resolve(files)
    })
  })
}

function transferKey(sessionId: string, remotePath: string, direction: string): string {
  return `${sessionId}:${direction}:${remotePath}`
}

export async function downloadFile(
  sessionId: string,
  remotePath: string,
  localPath: string,
  onProgress?: (transferred: number, total: number) => void
): Promise<void> {
  const sftp = await getSFTP(sessionId)
  const key = transferKey(sessionId, remotePath, 'download')
  const transfer: ActiveTransfer = { cancelled: false, sessionId }
  activeTransfers.set(key, transfer)

  return new Promise((resolve, reject) => {
    sftp.fastGet(remotePath, localPath, {
      concurrency: 4,
      chunkSize: 32768,
      step: (transferred, _chunk, total) => {
        if (transfer.cancelled) {
          activeTransfers.delete(key)
          reject(new Error('Transfer cancelled'))
          return
        }
        onProgress?.(transferred, total)
      }
    }, (err) => {
      activeTransfers.delete(key)
      if (transfer.cancelled) {
        reject(new Error('Transfer cancelled'))
        return
      }
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

export async function uploadFile(
  sessionId: string,
  localPath: string,
  remotePath: string,
  onProgress?: (transferred: number, total: number) => void
): Promise<void> {
  const sftp = await getSFTP(sessionId)
  const key = transferKey(sessionId, remotePath, 'upload')
  const transfer: ActiveTransfer = { cancelled: false, sessionId }
  activeTransfers.set(key, transfer)

  return new Promise((resolve, reject) => {
    sftp.fastPut(localPath, remotePath, {
      concurrency: 4,
      chunkSize: 32768,
      step: (transferred, _chunk, total) => {
        if (transfer.cancelled) {
          activeTransfers.delete(key)
          reject(new Error('Transfer cancelled'))
          return
        }
        onProgress?.(transferred, total)
      }
    }, (err) => {
      activeTransfers.delete(key)
      if (transfer.cancelled) {
        reject(new Error('Transfer cancelled'))
        return
      }
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

export function cancelTransfer(sessionId: string, remotePath: string, direction: string): boolean {
  const key = transferKey(sessionId, remotePath, direction)
  const transfer = activeTransfers.get(key)
  if (transfer) {
    transfer.cancelled = true
    return true
  }
  return false
}

export function cancelAllTransfers(sessionId: string): number {
  let cancelled = 0
  for (const [key, transfer] of activeTransfers.entries()) {
    if (transfer.sessionId === sessionId) {
      transfer.cancelled = true
      cancelled++
    }
  }
  return cancelled
}

export function getActiveTransfers(): string[] {
  return Array.from(activeTransfers.keys())
}

export async function deleteFile(sessionId: string, remotePath: string): Promise<void> {
  const sftp = await getSFTP(sessionId)

  return new Promise((resolve, reject) => {
    sftp.unlink(remotePath, (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

export async function deleteDirectory(sessionId: string, remotePath: string): Promise<void> {
  const sftp = await getSFTP(sessionId)

  return new Promise((resolve, reject) => {
    sftp.rmdir(remotePath, (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

export async function createDirectory(sessionId: string, remotePath: string): Promise<void> {
  const sftp = await getSFTP(sessionId)

  return new Promise((resolve, reject) => {
    sftp.mkdir(remotePath, (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

export async function renameFile(sessionId: string, oldPath: string, newPath: string): Promise<void> {
  const sftp = await getSFTP(sessionId)

  return new Promise((resolve, reject) => {
    sftp.rename(oldPath, newPath, (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

export async function chmodFile(sessionId: string, remotePath: string, mode: number): Promise<void> {
  const sftp = await getSFTP(sessionId)

  return new Promise((resolve, reject) => {
    sftp.chmod(remotePath, mode, (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

export function closeSFTP(sessionId: string): void {
  const sftp = sftpSessions.get(sessionId)
  if (sftp) {
    sftp.end()
    sftpSessions.delete(sessionId)
  }
}

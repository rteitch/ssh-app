import type { SFTPWrapper } from 'ssh2'
import path from 'path'
import { getSession } from './sshManager'
import type { SFTPFile } from '../../src/types'

const sftpSessions = new Map<string, SFTPWrapper>()

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

export async function downloadFile(
  sessionId: string,
  remotePath: string,
  localPath: string,
  onProgress?: (transferred: number, total: number) => void
): Promise<void> {
  const sftp = await getSFTP(sessionId)

  return new Promise((resolve, reject) => {
    sftp.fastGet(remotePath, localPath, {
      concurrency: 4,
      chunkSize: 32768,
      step: (transferred, _chunk, total) => {
        onProgress?.(transferred, total)
      }
    }, (err) => {
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

  return new Promise((resolve, reject) => {
    sftp.fastPut(localPath, remotePath, {
      concurrency: 4,
      chunkSize: 32768,
      step: (transferred, _chunk, total) => {
        onProgress?.(transferred, total)
      }
    }, (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
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

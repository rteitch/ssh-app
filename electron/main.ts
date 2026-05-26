import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { closeDatabase } from './db/database'
import * as knownHostsRepo from './db/knownHostsRepository'
import * as hostRepo from './db/hostRepository'
import * as snippetRepo from './db/snippetRepository'
import { encryptCredential, decryptCredential } from './security/credentialStore'
import * as sshManager from './ssh/sshManager'
import * as sftpManager from './ssh/sftpManager'
import { handleRemoteCompress, handleRemoteExtract } from './handlers/remote-archive'
import { handleLocalCompress, handleLocalExtract } from './handlers/local-archive'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  const isMac = process.platform === 'darwin'

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'SSH App',
    ...(isMac && {
      titleBarStyle: 'hiddenInset',
      vibrancy: 'under-window',
      visualEffectState: 'active',
      transparent: true,
      trafficLightPosition: { x: 12, y: 10 },
    }),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()
  registerIPC()

  // Periodic cleanup of stale SSH sessions (every 5 minutes)
  setInterval(() => {
    const cleaned = sshManager.cleanupStaleSessions()
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} stale SSH sessions`)
    }
  }, 5 * 60 * 1000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function validateSessionId(sessionId: string): void {
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error('Invalid session ID')
  }
}

function validatePath(p: string, name = 'path'): void {
  if (!p || typeof p !== 'string') {
    throw new Error(`Invalid ${name}`)
  }
  if (p.includes('\0')) {
    throw new Error(`Invalid ${name}: contains null byte`)
  }
  if (p.includes('..')) {
    throw new Error(`Invalid ${name}: path traversal not allowed`)
  }
}

function registerIPC() {
  // Host management
  ipcMain.handle('hosts:getAll', () => hostRepo.getAllHosts())
  ipcMain.handle('hosts:getById', (_event: any, id: string) => hostRepo.getHostById(id))
  ipcMain.handle('hosts:create', (_event: any, host: any) => {
    if (!host?.name || !host?.host || !host?.username || !host?.auth_type) {
      throw new Error('Missing required host fields: name, host, username, auth_type')
    }
    if (!['password', 'key', 'key_passphrase'].includes(host.auth_type)) {
      throw new Error('Invalid authentication type')
    }
    if (host.port && (typeof host.port !== 'number' || host.port < 1 || host.port > 65535)) {
      throw new Error('Port must be between 1 and 65535')
    }
    if (host.password_enc) {
      host.password_enc = encryptCredential(host.password_enc)
    }
    if (host.passphrase_enc) {
      host.passphrase_enc = encryptCredential(host.passphrase_enc)
    }
    return hostRepo.createHost(host)
  })
  ipcMain.handle('hosts:update', (_event: any, id: string, host: any) => {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid host ID')
    }
    if (host.auth_type && !['password', 'key', 'key_passphrase'].includes(host.auth_type)) {
      throw new Error('Invalid authentication type')
    }
    if (host.port && (typeof host.port !== 'number' || host.port < 1 || host.port > 65535)) {
      throw new Error('Port must be between 1 and 65535')
    }
    if (host.password_enc) {
      host.password_enc = encryptCredential(host.password_enc)
    }
    if (host.passphrase_enc) {
      host.passphrase_enc = encryptCredential(host.passphrase_enc)
    }
    return hostRepo.updateHost(id, host)
  })
  ipcMain.handle('hosts:delete', (_event: any, id: string) => hostRepo.deleteHost(id))

  // SSH connection
  ipcMain.handle('ssh:connect', async (_event: any, sessionId: string, config: any) => {
    validateSessionId(sessionId)
    if (!config?.host || !config?.username || !config?.auth_type) {
      throw new Error('Missing required connection fields: host, username, auth_type')
    }
    if (config.port && (typeof config.port !== 'number' || config.port < 1 || config.port > 65535)) {
      throw new Error('Port must be between 1 and 65535')
    }
    if (config.password) {
      config.password = decryptCredential(config.password)
    }
    if (config.passphrase) {
      config.passphrase = decryptCredential(config.passphrase)
    }
    await Promise.race([
      sshManager.connectSSH(sessionId, config),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout (30s)')), 30000)
      )
    ])
    hostRepo.updateLastUsed(config.hostId)
  })

  ipcMain.handle('ssh:disconnect', (_event: any, sessionId: string) => {
    validateSessionId(sessionId)
    sftpManager.closeSFTP(sessionId)
    sshManager.disconnectSSH(sessionId)
  })

  ipcMain.handle('ssh:isConnected', (_event: any, sessionId: string) => {
    validateSessionId(sessionId)
    return sshManager.isConnected(sessionId)
  })

  // Shell
  ipcMain.handle('ssh:openShell', async (_event: any, sessionId: string) => {
    validateSessionId(sessionId)
    const stream = await sshManager.openShell(
      sessionId,
      (data) => {
        mainWindow?.webContents.send('ssh:shellData', sessionId, data)
      },
      () => {
        mainWindow?.webContents.send('ssh:shellClose', sessionId)
      }
    )
    return !!stream
  })

  ipcMain.handle('ssh:write', (_event: any, sessionId: string, data: string) => {
    validateSessionId(sessionId)
    sshManager.writeToShell(sessionId, data)
  })

  ipcMain.handle('ssh:resize', (_event: any, sessionId: string, cols: number, rows: number) => {
    validateSessionId(sessionId)
    if (typeof cols !== 'number' || typeof rows !== 'number' || cols < 1 || rows < 1) {
      throw new Error('Invalid resize dimensions')
    }
    sshManager.resizeShell(sessionId, cols, rows)
  })

  // SFTP
  ipcMain.handle('sftp:list', async (_event: any, sessionId: string, remotePath: string) => {
    validateSessionId(sessionId)
    validatePath(remotePath, 'remote path')
    return sftpManager.listDirectory(sessionId, remotePath)
  })

  ipcMain.handle('sftp:download', async (_event: any, sessionId: string, remotePath: string, localPath: string) => {
    validateSessionId(sessionId)
    validatePath(remotePath, 'remote path')
    validatePath(localPath, 'local path')
    await sftpManager.downloadFile(sessionId, remotePath, localPath, (transferred, total) => {
      mainWindow?.webContents.send('sftp:progress', { remotePath, localPath, transferred, total, percent: total > 0 ? Math.round((transferred / total) * 100) : 0 })
    })
  })

  ipcMain.handle('sftp:upload', async (_event: any, sessionId: string, localPath: string, remotePath: string) => {
    validateSessionId(sessionId)
    validatePath(localPath, 'local path')
    validatePath(remotePath, 'remote path')
    await sftpManager.uploadFile(sessionId, localPath, remotePath, (transferred, total) => {
      mainWindow?.webContents.send('sftp:progress', { localPath, remotePath, transferred, total, percent: total > 0 ? Math.round((transferred / total) * 100) : 0 })
    })
  })

  ipcMain.handle('sftp:delete', async (_event: any, sessionId: string, remotePath: string) => {
    validateSessionId(sessionId)
    validatePath(remotePath, 'remote path')
    await sftpManager.deleteFile(sessionId, remotePath)
  })

  ipcMain.handle('sftp:mkdir', async (_event: any, sessionId: string, remotePath: string) => {
    validateSessionId(sessionId)
    validatePath(remotePath, 'remote path')
    await sftpManager.createDirectory(sessionId, remotePath)
  })

  ipcMain.handle('sftp:rename', async (_event: any, sessionId: string, oldPath: string, newPath: string) => {
    validateSessionId(sessionId)
    validatePath(oldPath, 'old path')
    validatePath(newPath, 'new path')
    await sftpManager.renameFile(sessionId, oldPath, newPath)
  })

  ipcMain.handle('sftp:chmod', async (_event: any, sessionId: string, remotePath: string, mode: number) => {
    validateSessionId(sessionId)
    validatePath(remotePath, 'remote path')
    if (typeof mode !== 'number' || mode < 0 || mode > 0o777) {
      throw new Error('Invalid file mode (must be 0-0o777)')
    }
    await sftpManager.chmodFile(sessionId, remotePath, mode)
  })

  ipcMain.handle('sftp:cancel', (_event: any, sessionId: string, remotePath: string, localPath: string, direction: string) => {
    validateSessionId(sessionId)
    validatePath(remotePath, 'remote path')
    validatePath(localPath, 'local path')
    return sftpManager.cancelTransfer(sessionId, remotePath, localPath, direction)
  })

  ipcMain.handle('sftp:cancelAll', (_event: any, sessionId: string) => {
    validateSessionId(sessionId)
    return sftpManager.cancelAllTransfers(sessionId)
  })

  // Snippets
  ipcMain.handle('snippets:getAll', () => snippetRepo.getAllSnippets())
  ipcMain.handle('snippets:create', (_event: any, snippet: any) => {
    if (!snippet?.name?.trim() || !snippet?.command?.trim()) {
      throw new Error('Snippet name and command are required')
    }
    return snippetRepo.createSnippet({
      name: snippet.name.trim(),
      command: snippet.command.trim(),
      tag: snippet.tag?.trim() || undefined
    })
  })
  ipcMain.handle('snippets:update', (_event: any, id: string, snippet: any) => {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid snippet ID')
    }
    const updateData: any = {}
    if (snippet.name !== undefined) {
      if (!snippet.name.trim()) throw new Error('Snippet name cannot be empty')
      updateData.name = snippet.name.trim()
    }
    if (snippet.command !== undefined) {
      if (!snippet.command.trim()) throw new Error('Snippet command cannot be empty')
      updateData.command = snippet.command.trim()
    }
    if (snippet.tag !== undefined) {
      updateData.tag = snippet.tag.trim() || null
    }
    return snippetRepo.updateSnippet(id, updateData)
  })
  ipcMain.handle('snippets:delete', (_event: any, id: string) => snippetRepo.deleteSnippet(id))

  // Known Hosts
  ipcMain.handle('knownHosts:getAll', () => knownHostsRepo.getAllKnownHosts())
  ipcMain.handle('knownHosts:remove', (_event: any, host: string, port: number) => knownHostsRepo.removeKnownHost(host, port))

  // Dialogs
  ipcMain.handle('dialog:open', async (_event: any, options: any) => {
    if (!mainWindow) return { canceled: true, filePaths: [] }
    return dialog.showOpenDialog(mainWindow, options)
  })

  ipcMain.handle('dialog:save', async (_event: any, options: any) => {
    if (!mainWindow) return { canceled: true, filePath: undefined }
    return dialog.showSaveDialog(mainWindow, options)
  })

  // Local File System
  ipcMain.handle('fs:listLocal', async (_event: any, inputPath: string) => {
    try {
      validatePath(inputPath, 'input path')
      const resolvedPath = path.resolve(inputPath)

      // Safety check: ensure resolvedPath exists and is a directory
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Path does not exist: ${inputPath}`)
      }

      const stats = await fs.promises.stat(resolvedPath)
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${inputPath}`)
      }

      const files = await fs.promises.readdir(resolvedPath, { withFileTypes: true })
      
      const fileList = await Promise.all(files.map(async (dirent) => {
        const filePath = path.join(resolvedPath, dirent.name)
        let fstats
        try {
          fstats = await fs.promises.stat(filePath)
        } catch (err) {
          fstats = { size: 0, mode: 0, atimeMs: 0, mtimeMs: 0, uid: 0, gid: 0 } as any
        }
        
        return {
          filename: dirent.name,
          longname: dirent.name,
          attrs: {
            size: fstats.size,
            mode: fstats.mode,
            atime: Math.round((fstats.atimeMs || 0) / 1000),
            mtime: Math.round((fstats.mtimeMs || 0) / 1000),
            uid: fstats.uid || 0,
            gid: fstats.gid || 0
          },
          isDirectory: dirent.isDirectory()
        }
      }))

      return fileList
    } catch (err: any) {
      console.error('Error listing local directory:', err)
      throw new Error(err.message || String(err))
    }
  })

  ipcMain.handle('fs:getHomeDir', () => {
    return app.getPath('home')
  })

  ipcMain.handle('fs:deleteLocal', async (_event: any, inputPath: string) => {
    try {
      validatePath(inputPath, 'input path')
      const resolvedPath = path.resolve(inputPath)
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`File does not exist: ${inputPath}`)
      }
      
      // Safety block: prevent deleting critical system folders or root
      const home = path.resolve(app.getPath('home'))
      if (resolvedPath === '/' || resolvedPath === 'C:\\' || resolvedPath === home) {
        throw new Error('Deletions at root or user home directory are blocked for safety.')
      }

      const stats = fs.statSync(resolvedPath)
      if (stats.isDirectory()) {
        fs.rmSync(resolvedPath, { recursive: true, force: true })
      } else {
        fs.unlinkSync(resolvedPath)
      }
      return true
    } catch (err: any) {
      throw new Error(err.message || String(err))
    }
  })

  ipcMain.handle('fs:mkdirLocal', async (_event: any, inputPath: string) => {
    try {
      validatePath(inputPath, 'input path')
      const resolvedPath = path.resolve(inputPath)
      if (fs.existsSync(resolvedPath)) {
        throw new Error('Directory already exists')
      }
      fs.mkdirSync(resolvedPath, { recursive: true })
      return true
    } catch (err: any) {
      throw new Error(err.message || String(err))
    }
  })

  ipcMain.handle('fs:renameLocal', async (_event: any, oldPath: string, newPath: string) => {
    try {
      validatePath(oldPath, 'old path')
      validatePath(newPath, 'new path')
      const resolvedOld = path.resolve(oldPath)
      const resolvedNew = path.resolve(newPath)
      if (!fs.existsSync(resolvedOld)) {
        throw new Error(`Path does not exist: ${oldPath}`)
      }
      fs.renameSync(resolvedOld, resolvedNew)
      return true
    } catch (err: any) {
      throw new Error(err.message || String(err))
    }
  })

  ipcMain.handle('fs:existsLocal', async (_event: any, inputPath: string) => {
    try {
      validatePath(inputPath, 'input path')
      const resolvedPath = path.resolve(inputPath)
      return fs.existsSync(resolvedPath)
    } catch {
      return false
    }
  })

  // ── Enterprise Archive Handlers ─────────────────────────────────────
  ipcMain.handle('sftp:remoteCompress', (event, opts) => {
    if (!mainWindow) throw new Error('Main window not available')
    return handleRemoteCompress(event, opts, mainWindow)
  })

  ipcMain.handle('sftp:remoteExtract', (event, opts) => {
    if (!mainWindow) throw new Error('Main window not available')
    return handleRemoteExtract(event, opts, mainWindow)
  })

  ipcMain.handle('fs:localCompress', (event, opts) => {
    if (!mainWindow) throw new Error('Main window not available')
    return handleLocalCompress(event, opts, mainWindow)
  })

  ipcMain.handle('fs:localExtract', (event, opts) => {
    if (!mainWindow) throw new Error('Main window not available')
    return handleLocalExtract(event, opts, mainWindow)
  })
}

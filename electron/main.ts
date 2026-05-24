import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { closeDatabase } from './db/database'
import * as hostRepo from './db/hostRepository'
import * as snippetRepo from './db/snippetRepository'
import { encryptCredential, decryptCredential } from './security/credentialStore'
import * as sshManager from './ssh/sshManager'
import * as sftpManager from './ssh/sftpManager'

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
      transparent: false,
      trafficLightPosition: { x: 16, y: 18 },
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

function registerIPC() {
  // Host management
  ipcMain.handle('hosts:getAll', () => hostRepo.getAllHosts())
  ipcMain.handle('hosts:getById', (_event: any, id: string) => hostRepo.getHostById(id))
  ipcMain.handle('hosts:create', (_event: any, host: any) => {
    if (host.password_enc) {
      host.password_enc = encryptCredential(host.password_enc)
    }
    if (host.passphrase_enc) {
      host.passphrase_enc = encryptCredential(host.passphrase_enc)
    }
    return hostRepo.createHost(host)
  })
  ipcMain.handle('hosts:update', (_event: any, id: string, host: any) => {
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
    if (config.password) {
      config.password = decryptCredential(config.password)
    }
    if (config.passphrase) {
      config.passphrase = decryptCredential(config.passphrase)
    }
    await sshManager.connectSSH(sessionId, config)
    hostRepo.updateLastUsed(config.hostId)
  })

  ipcMain.handle('ssh:disconnect', (_event: any, sessionId: string) => {
    sftpManager.closeSFTP(sessionId)
    sshManager.disconnectSSH(sessionId)
  })

  ipcMain.handle('ssh:isConnected', (_event: any, sessionId: string) => {
    return sshManager.isConnected(sessionId)
  })

  // Shell
  ipcMain.handle('ssh:openShell', async (_event: any, sessionId: string) => {
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
    sshManager.writeToShell(sessionId, data)
  })

  ipcMain.handle('ssh:resize', (_event: any, sessionId: string, cols: number, rows: number) => {
    sshManager.resizeShell(sessionId, cols, rows)
  })

  // SFTP
  ipcMain.handle('sftp:list', async (_event: any, sessionId: string, remotePath: string) => {
    return sftpManager.listDirectory(sessionId, remotePath)
  })

  ipcMain.handle('sftp:download', async (_event: any, sessionId: string, remotePath: string, localPath: string) => {
    await sftpManager.downloadFile(sessionId, remotePath, localPath, (transferred, total) => {
      mainWindow?.webContents.send('sftp:progress', { remotePath, localPath, transferred, total, percent: Math.round((transferred / total) * 100) })
    })
  })

  ipcMain.handle('sftp:upload', async (_event: any, sessionId: string, localPath: string, remotePath: string) => {
    await sftpManager.uploadFile(sessionId, localPath, remotePath, (transferred, total) => {
      mainWindow?.webContents.send('sftp:progress', { localPath, remotePath, transferred, total, percent: Math.round((transferred / total) * 100) })
    })
  })

  ipcMain.handle('sftp:delete', async (_event: any, sessionId: string, remotePath: string) => {
    await sftpManager.deleteFile(sessionId, remotePath)
  })

  ipcMain.handle('sftp:mkdir', async (_event: any, sessionId: string, remotePath: string) => {
    await sftpManager.createDirectory(sessionId, remotePath)
  })

  ipcMain.handle('sftp:rename', async (_event: any, sessionId: string, oldPath: string, newPath: string) => {
    await sftpManager.renameFile(sessionId, oldPath, newPath)
  })

  ipcMain.handle('sftp:chmod', async (_event: any, sessionId: string, remotePath: string, mode: number) => {
    await sftpManager.chmodFile(sessionId, remotePath, mode)
  })

  // Snippets
  ipcMain.handle('snippets:getAll', () => snippetRepo.getAllSnippets())
  ipcMain.handle('snippets:create', (_event: any, snippet: any) => snippetRepo.createSnippet(snippet))
  ipcMain.handle('snippets:update', (_event: any, id: string, snippet: any) => snippetRepo.updateSnippet(id, snippet))
  ipcMain.handle('snippets:delete', (_event: any, id: string) => snippetRepo.deleteSnippet(id))

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
      const resolvedPath = path.resolve(inputPath)
      
      // Safety check: ensure resolvedPath exists and is a directory
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Path does not exist: ${inputPath}`)
      }
      
      const stats = fs.statSync(resolvedPath)
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${inputPath}`)
      }

      const files = fs.readdirSync(resolvedPath, { withFileTypes: true })
      
      const fileList = files.map(dirent => {
        const filePath = path.join(resolvedPath, dirent.name)
        let fstats
        try {
          fstats = fs.statSync(filePath)
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
      })

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
      const resolvedPath = path.resolve(inputPath)
      return fs.existsSync(resolvedPath)
    } catch {
      return false
    }
  })
}

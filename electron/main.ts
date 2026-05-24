import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
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
      mainWindow?.webContents.send('sftp:progress', { transferred, total, percent: Math.round((transferred / total) * 100) })
    })
  })

  ipcMain.handle('sftp:upload', async (_event: any, sessionId: string, localPath: string, remotePath: string) => {
    await sftpManager.uploadFile(sessionId, localPath, remotePath, (transferred, total) => {
      mainWindow?.webContents.send('sftp:progress', { transferred, total, percent: Math.round((transferred / total) * 100) })
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
}

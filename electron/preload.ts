import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('sshApi', {
  // Host management
  getHosts: () => ipcRenderer.invoke('hosts:getAll'),
  getHost: (id: string) => ipcRenderer.invoke('hosts:getById', id),
  createHost: (host: any) => ipcRenderer.invoke('hosts:create', host),
  updateHost: (id: string, host: any) => ipcRenderer.invoke('hosts:update', id, host),
  deleteHost: (id: string) => ipcRenderer.invoke('hosts:delete', id),

  // SSH connection
  connect: (sessionId: string, config: any) => ipcRenderer.invoke('ssh:connect', sessionId, config),
  disconnect: (sessionId: string) => ipcRenderer.invoke('ssh:disconnect', sessionId),
  isConnected: (sessionId: string) => ipcRenderer.invoke('ssh:isConnected', sessionId),

  // Shell
  openShell: (sessionId: string) => ipcRenderer.invoke('ssh:openShell', sessionId),
  writeToShell: (sessionId: string, data: string) => ipcRenderer.invoke('ssh:write', sessionId, data),
  resizeShell: (sessionId: string, cols: number, rows: number) => ipcRenderer.invoke('ssh:resize', sessionId, cols, rows),

  // Shell events
  onShellData: (sessionId: string, callback: (data: string) => void) => {
    const handler = (_event: any, sid: string, data: string) => {
      if (sid === sessionId) callback(data)
    }
    ipcRenderer.on('ssh:shellData', handler)
    return () => ipcRenderer.removeListener('ssh:shellData', handler)
  },
  onShellClose: (sessionId: string, callback: () => void) => {
    const handler = (_event: any, sid: string) => {
      if (sid === sessionId) callback()
    }
    ipcRenderer.on('ssh:shellClose', handler)
    return () => ipcRenderer.removeListener('ssh:shellClose', handler)
  },

  // SFTP
  sftpList: (sessionId: string, remotePath: string) => ipcRenderer.invoke('sftp:list', sessionId, remotePath),
  sftpDownload: (sessionId: string, remotePath: string, localPath: string) => ipcRenderer.invoke('sftp:download', sessionId, remotePath, localPath),
  sftpUpload: (sessionId: string, localPath: string, remotePath: string) => ipcRenderer.invoke('sftp:upload', sessionId, localPath, remotePath),
  sftpDelete: (sessionId: string, remotePath: string) => ipcRenderer.invoke('sftp:delete', sessionId, remotePath),
  sftpMkdir: (sessionId: string, remotePath: string) => ipcRenderer.invoke('sftp:mkdir', sessionId, remotePath),
  sftpRename: (sessionId: string, oldPath: string, newPath: string) => ipcRenderer.invoke('sftp:rename', sessionId, oldPath, newPath),
  sftpChmod: (sessionId: string, remotePath: string, mode: number) => ipcRenderer.invoke('sftp:chmod', sessionId, remotePath, mode),

  // Snippets
  getSnippets: () => ipcRenderer.invoke('snippets:getAll'),
  createSnippet: (snippet: any) => ipcRenderer.invoke('snippets:create', snippet),
  updateSnippet: (id: string, snippet: any) => ipcRenderer.invoke('snippets:update', id, snippet),
  deleteSnippet: (id: string) => ipcRenderer.invoke('snippets:delete', id),

  // Dialog
  showOpenDialog: (options: any) => ipcRenderer.invoke('dialog:open', options),
  showSaveDialog: (options: any) => ipcRenderer.invoke('dialog:save', options),

  // Local File System
  fsListLocal: (path: string) => ipcRenderer.invoke('fs:listLocal', path),
  fsGetHomeDir: () => ipcRenderer.invoke('fs:getHomeDir'),
  fsDeleteLocal: (path: string) => ipcRenderer.invoke('fs:deleteLocal', path),
  fsMkdirLocal: (path: string) => ipcRenderer.invoke('fs:mkdirLocal', path),
  fsRenameLocal: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:renameLocal', oldPath, newPath),
  fsExistsLocal: (path: string) => ipcRenderer.invoke('fs:existsLocal', path),

  // Transfer progress
  onTransferProgress: (callback: (progress: any) => void) => {
    const handler = (_event: any, progress: any) => callback(progress)
    ipcRenderer.on('sftp:progress', handler)
    return () => ipcRenderer.removeListener('sftp:progress', handler)
  }
})

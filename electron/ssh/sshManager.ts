import { Client, type ClientChannel, type ConnectConfig } from 'ssh2'
import fs from 'fs'
import crypto from 'crypto'
import { BrowserWindow, dialog } from 'electron'
import * as knownHostsRepo from '../db/knownHostsRepository'
import type { SSHConnectionConfig } from '../../src/types'
import { closeSFTP } from './sftpManager'

function getAgentSocket(): string | undefined {
  if (process.platform === 'win32') {
    return process.env.OPENSSH_AUTH_SOCK || process.env.SSH_AUTH_SOCK
  }
  return process.env.SSH_AUTH_SOCK
}

export interface SSHSession {
  id: string
  client: Client
  shell?: ClientChannel
  connected: boolean
  host: string
  port: number
}

const sessions = new Map<string, SSHSession>()

export function createSession(sessionId: string): SSHSession {
  const client = new Client()
  const session: SSHSession = {
    id: sessionId,
    client,
    connected: false,
    host: '',
    port: 22
  }
  sessions.set(sessionId, session)
  return session
}

export function getSession(sessionId: string): SSHSession | undefined {
  return sessions.get(sessionId)
}

function formatFingerprint(keyBuffer: Buffer): string {
  const hash = crypto.createHash('sha256').update(keyBuffer).digest('base64')
  return `SHA256:${hash}`
}

async function verifyHostKey(host: string, port: number, keyBuffer: Buffer): Promise<boolean> {
  const fingerprint = formatFingerprint(keyBuffer)
  const knownHost = knownHostsRepo.getKnownHost(host, port)

  if (!knownHost) {
    // First time connecting to this host — ask user
    const result = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Accept & Save', 'Reject'],
      defaultId: 0,
      cancelId: 1,
      title: 'Unknown Host Key',
      message: `The authenticity of host '${host}:${port}' can't be established.`,
      detail: `SHA256 fingerprint:\n${fingerprint}\n\nAre you sure you want to continue connecting?\nThe host key will be saved for future connections.`,
      noLink: true
    })

    if (result.response === 0) {
      knownHostsRepo.addKnownHost(host, port, fingerprint)
      return true
    }
    return false
  }

  if (knownHost.fingerprint !== fingerprint) {
    // Fingerprint changed — possible MITM attack!
    const result = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Update Key', 'Cancel Connection'],
      defaultId: 1,
      cancelId: 1,
      title: '⚠ WARNING: Host Key Changed!',
      message: `REMOTE HOST IDENTIFICATION HAS CHANGED for '${host}:${port}'!`,
      detail: `Expected: ${knownHost.fingerprint}\nReceived: ${fingerprint}\n\nThis could indicate a man-in-the-middle attack!\nOnly proceed if you trust this change.`,
      noLink: true
    })

    if (result.response === 0) {
      knownHostsRepo.updateFingerprint(host, port, fingerprint)
      return true
    }
    return false
  }

  return true // Fingerprint matches
}

export function connectSSH(sessionId: string, config: SSHConnectionConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    let session = sessions.get(sessionId)
    if (!session) {
      session = createSession(sessionId)
    } else {
      session.client.removeAllListeners()
    }

    session.host = config.host
    session.port = config.port

    const connectConfig: ConnectConfig = {
      host: config.host,
      port: config.port,
      username: config.username,
      readyTimeout: 15000,
      keepaliveInterval: 10000,
      keepaliveCountMax: 3,
      compress: true,
      agentForward: false
    }

    // SSH agent support for key-based auth
    const agentSocket = getAgentSocket()
    if (agentSocket && config.auth_type === 'key' && !config.key_path) {
      connectConfig.agent = agentSocket
      connectConfig.agentForward = true
    }

    // Host key verification
    connectConfig.hostVerifier = async (keyBuffer: Buffer) => {
      try {
        return await verifyHostKey(config.host, config.port, keyBuffer)
      } catch (err) {
        return false
      }
    }

    if (config.auth_type === 'password' && config.password) {
      connectConfig.password = config.password
      // Also handle keyboard-interactive prompts that expect the password
      connectConfig.tryKeyboard = true
    } else if (config.auth_type === 'key' && config.key_path) {
      try {
        connectConfig.privateKey = fs.readFileSync(config.key_path)
      } catch (err) {
        reject(new Error(`Cannot read SSH key file: ${config.key_path}`))
        return
      }
    } else if (config.auth_type === 'key_passphrase' && config.key_path && config.passphrase) {
      try {
        connectConfig.privateKey = fs.readFileSync(config.key_path)
        connectConfig.passphrase = config.passphrase
      } catch (err) {
        reject(new Error(`Cannot read SSH key file: ${config.key_path}`))
        return
      }
    }

    // Handle keyboard-interactive authentication (2FA, Duo, etc.)
    session.client.on('keyboard-interactive', (_name, _instructions, _instructionsLang, prompts, finish) => {
      if (config.auth_type === 'password' && config.password) {
        // Auto-respond with password for all prompts
        finish([config.password])
      } else {
        // Can't handle interactive prompts without a password
        finish([])
      }
    })

    session.client.on('ready', () => {
      session!.connected = true
      resolve()
    })

    session.client.on('error', (err) => {
      session!.connected = false
      try { closeSFTP(sessionId) } catch {}
      reject(err)
    })

    session.client.on('close', () => {
      session!.connected = false
      try { closeSFTP(sessionId) } catch {}
    })

    session.client.on('end', () => {
      session!.connected = false
      try { closeSFTP(sessionId) } catch {}
    })

    session.client.connect(connectConfig)
  })
}

export function openShell(sessionId: string, onData: (data: string) => void, onClose: () => void): Promise<ClientChannel> {
  return new Promise((resolve, reject) => {
    const session = sessions.get(sessionId)
    if (!session || !session.connected) {
      reject(new Error('Session not connected'))
      return
    }

    session.client.shell({ term: 'xterm-256color' }, (err, stream) => {
      if (err) {
        reject(err)
        return
      }

      session.shell = stream

      stream.on('data', (data: Buffer) => {
        onData(data.toString('utf-8'))
      })

      stream.on('close', () => {
        session.shell = undefined
        onClose()
      })

      stream.stderr.on('data', (data: Buffer) => {
        onData(data.toString('utf-8'))
      })

      resolve(stream)
    })
  })
}

export function writeToShell(sessionId: string, data: string): boolean {
  const session = sessions.get(sessionId)
  if (!session?.shell) {
    console.error(`Shell not available for session ${sessionId}`)
    return false
  }
  try {
    session.shell.write(data)
    return true
  } catch (err) {
    console.error('Write to shell failed:', err)
    return false
  }
}

export function resizeShell(sessionId: string, cols: number, rows: number): void {
  const session = sessions.get(sessionId)
  if (session?.shell) {
    session.shell.setWindow(rows, cols, 0, 0)
  }
}

export function disconnectSSH(sessionId: string): void {
  const session = sessions.get(sessionId)
  if (session) {
    if (session.shell) {
      try { session.shell.end?.() } catch {}
      session.shell.close()
    }
    session.client.end()
    session.connected = false
    sessions.delete(sessionId)
    try { closeSFTP(sessionId) } catch {}
  }
}

export function isConnected(sessionId: string): boolean {
  return sessions.get(sessionId)?.connected ?? false
}

export function getSFTP(sessionId: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const session = sessions.get(sessionId)
    if (!session || !session.connected) {
      reject(new Error('Session not connected'))
      return
    }

    session.client.sftp((err, sftp) => {
      if (err) {
        reject(err)
        return
      }
      resolve(sftp)
    })
  })
}

export function executeCommand(sessionId: string, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const session = sessions.get(sessionId)
    if (!session || !session.connected) {
      reject(new Error('Session not connected'))
      return
    }

    session.client.exec(command, (err, stream) => {
      if (err) {
        reject(err)
        return
      }

      let stdout = ''
      let stderr = ''

      stream.on('data', (data: Buffer) => {
        stdout += data.toString('utf-8')
      })

      stream.stderr.on('data', (data: Buffer) => {
        stderr += data.toString('utf-8')
      })

      stream.on('close', (code: number) => {
        if (code === 0) {
          resolve(stdout)
        } else {
          reject(new Error(`Command exited with code ${code}: ${stderr}`))
        }
      })
    })
  })
}

export function executeCommandWithStream(
  sessionId: string,
  command: string,
  onStderr: (data: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const session = sessions.get(sessionId)
    if (!session || !session.connected) {
      reject(new Error('Session not connected'))
      return
    }

    session.client.exec(command, (err, stream) => {
      if (err) {
        reject(err)
        return
      }

      // Salurkan stdout dan stderr ke callback agar user mendapat feedback real-time
      stream.on('data', (data: Buffer) => {
        onStderr(data.toString('utf-8'))
      })

      stream.stderr.on('data', (data: Buffer) => {
        onStderr(data.toString('utf-8'))
      })

      stream.on('close', (code: number) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`Command exited with code ${code}`))
        }
      })
    })
  })
}

export function getSessionCount(): number {
  return sessions.size
}

export function cleanupStaleSessions(): number {
  let cleaned = 0
  for (const [id, session] of sessions.entries()) {
    if (!session.connected) {
      try {
        session.client.end()
      } catch {}
      try {
        closeSFTP(id)
      } catch {}
      sessions.delete(id)
      cleaned++
    }
  }
  return cleaned
}

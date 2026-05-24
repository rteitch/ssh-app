import { Client, type ClientChannel, type ConnectConfig } from 'ssh2'
import fs from 'fs'
import { decryptCredential } from '../security/credentialStore'
import type { SSHConnectionConfig } from '../../src/types'

export interface SSHSession {
  id: string
  client: Client
  shell?: ClientChannel
  connected: boolean
}

const sessions = new Map<string, SSHSession>()

export function createSession(sessionId: string): SSHSession {
  const client = new Client()
  const session: SSHSession = {
    id: sessionId,
    client,
    connected: false
  }
  sessions.set(sessionId, session)
  return session
}

export function getSession(sessionId: string): SSHSession | undefined {
  return sessions.get(sessionId)
}

export function connectSSH(sessionId: string, config: SSHConnectionConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    let session = sessions.get(sessionId)
    if (!session) {
      session = createSession(sessionId)
    }

    const connectConfig: ConnectConfig = {
      host: config.host,
      port: config.port,
      username: config.username,
      readyTimeout: 10000,
      keepaliveInterval: 10000
    }

    if (config.auth_type === 'password' && config.password) {
      connectConfig.password = config.password
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

    session.client.on('ready', () => {
      session!.connected = true
      resolve()
    })

    session.client.on('error', (err) => {
      session!.connected = false
      reject(err)
    })

    session.client.on('close', () => {
      session!.connected = false
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

export function writeToShell(sessionId: string, data: string): void {
  const session = sessions.get(sessionId)
  if (session?.shell) {
    session.shell.write(data)
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
      session.shell.close()
    }
    session.client.end()
    session.connected = false
    sessions.delete(sessionId)
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

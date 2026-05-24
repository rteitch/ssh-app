export interface Host {
  id: string
  name: string
  group_name: string
  host: string
  port: number
  username: string
  auth_type: 'password' | 'key' | 'key_passphrase'
  password_enc?: string
  key_path?: string
  passphrase_enc?: string
  created_at: string
  last_used?: string
}

export interface Snippet {
  id: string
  name: string
  command: string
  tag?: string
}

export interface KnownHost {
  host: string
  port: number
  fingerprint: string
  added_at: string
}

export interface SSHConnectionConfig {
  host: string
  port: number
  username: string
  auth_type: 'password' | 'key' | 'key_passphrase'
  password?: string
  key_path?: string
  passphrase?: string
}

export interface SFTPFile {
  filename: string
  longname: string
  attrs: {
    size: number
    mode: number
    atime: number
    mtime: number
    uid: number
    gid: number
  }
  isDirectory: boolean
}

export interface TransferProgress {
  transferred: number
  total: number
  percent: number
}

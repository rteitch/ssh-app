import { safeStorage } from 'electron'

export function encryptCredential(plaintext: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is not available on this system')
  }
  const encrypted = safeStorage.encryptString(plaintext)
  return encrypted.toString('base64')
}

export function decryptCredential(encrypted: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is not available on this system')
  }
  const buffer = Buffer.from(encrypted, 'base64')
  return safeStorage.decryptString(buffer)
}

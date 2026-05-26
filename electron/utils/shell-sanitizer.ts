import path from 'path'

export interface SanitizedPath {
  quoted: string;    // siap pakai dalam perintah shell
  basename: string;  // nama file tanpa path
  dirpath: string;   // direktori induk
}

/**
 * Validasi dan sanitasi path remote sebelum dimasukkan ke perintah SSH.
 * Melempar error jika path mengandung karakter berbahaya.
 */
export function sanitizeRemotePath(rawPath: string): SanitizedPath {
  if (typeof rawPath !== 'string') {
    throw new Error('Path must be a string');
  }

  // Batasi panjang path (cegah DoS via input panjang)
  if (rawPath.length > 4096) {
    throw new Error('Path exceeds maximum allowed length (4096 chars)');
  }

  // Tolak null bytes — teknik bypass umum
  if (rawPath.includes('\0')) {
    throw new Error('Path contains null byte — rejected');
  }

  // Tolak karakter shell metacharacter yang paling berbahaya
  // Referensi: OWASP Command Injection Prevention
  const DANGEROUS_CHARS = /[;&|`$(){}[\]<>!#~*?\\]/;
  if (DANGEROUS_CHARS.test(rawPath)) {
    throw new Error(`Path contains unsafe shell metacharacters: ${rawPath}`);
  }

  // Cegah path traversal (../../etc/passwd)
  const normalized = rawPath.replace(/\/+/g, '/');
  if (normalized.includes('../') || normalized.includes('/..')) {
    throw new Error('Path traversal attempt detected');
  }

  const parts = normalized.split('/');
  const basename = parts[parts.length - 1] || '';
  const dirpath = parts.slice(0, -1).join('/') || '.';

  return {
    quoted: JSON.stringify(normalized),  // JSON.stringify menghasilkan quoted string yang aman
    basename,
    dirpath,
  };
}

/**
 * Validasi nama arsip output (untuk kompresi remote).
 * Nama arsip tidak boleh mengandung path separator.
 */
export function sanitizeArchiveName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new Error('Archive name must be a non-empty string');
  }
  if (name.includes('/') || name.includes('\\') || name.includes('\0')) {
    throw new Error('Archive name must not contain path separators');
  }
  // Hanya izinkan karakter alfanumerik, titik, strip, underscore
  if (!/^[\w.\-]+$/.test(name)) {
    throw new Error('Archive name contains invalid characters');
  }
  return name;
}

/**
 * Proteksi ZIP Slip / path traversal saat ekstraksi lokal.
 * Setiap entry dalam arsip harus berada di dalam destDir.
 *
 * Referensi: https://en.wikipedia.org/wiki/Directory_traversal_attack
 * (seksi "Zip Slip vulnerability")
 */
export function validateExtractEntry(entryPath: string, destDir: string): void {
  const resolvedDest = path.resolve(destDir);
  const resolvedEntry = path.resolve(destDir, entryPath);

  if (!resolvedEntry.startsWith(resolvedDest + path.sep) &&
      resolvedEntry !== resolvedDest) {
    throw new Error(
      `ZIP Slip attack detected: entry "${entryPath}" would extract outside destination`
    );
  }
}

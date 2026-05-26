import { IpcMainInvokeEvent, BrowserWindow } from 'electron'
import { sanitizeRemotePath, sanitizeArchiveName } from '../utils/shell-sanitizer'
import * as sshManager from '../ssh/sshManager'

export type ArchiveType = 'zip' | 'tar.gz' | 'tar.bz2' | 'tar.xz';

export interface RemoteCompressOptions {
  sessionId: string;
  remotePath: string;       // path file/folder yang akan dikompresi
  archiveName: string;      // nama output arsip (tanpa path)
  archiveType: ArchiveType;
}

export interface RemoteExtractOptions {
  sessionId: string;
  archivePath: string;      // path arsip yang akan diekstrak
  destDir?: string;         // opsional: direktori tujuan
}

/**
 * Mapping format arsip ke perintah kompresi Linux.
 * Menggunakan JSON.stringify untuk shell-safe quoting.
 */
function buildCompressCommand(
  safeSrc: string,
  safeDest: string,
  archiveType: ArchiveType
): string {
  const commands: Record<ArchiveType, string> = {
    'zip':     `zip -r ${safeDest} ${safeSrc}`,
    'tar.gz':  `tar -czf ${safeDest} ${safeSrc}`,
    'tar.bz2': `tar -cjf ${safeDest} ${safeSrc}`,
    'tar.xz':  `tar -cJf ${safeDest} ${safeSrc}`,
  };
  return commands[archiveType];
}

/**
 * Deteksi format arsip dari ekstensi nama file.
 */
function detectArchiveFormat(filename: string): string | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz'))  return 'tar.gz';
  if (lower.endsWith('.tar.bz2') || lower.endsWith('.tbz2')) return 'tar.bz2';
  if (lower.endsWith('.tar.xz') || lower.endsWith('.txz'))  return 'tar.xz';
  if (lower.endsWith('.tar'))    return 'tar';
  if (lower.endsWith('.zip'))    return 'zip';
  if (lower.endsWith('.gz'))     return 'gz';
  if (lower.endsWith('.bz2'))    return 'bz2';
  return null;
}

/**
 * Mapping format arsip ke perintah ekstraksi Linux.
 */
function buildExtractCommand(
  safeSrc: string,
  safeDest: string,
  format: string
): string | null {
  const commands: Record<string, string> = {
    'zip':     `unzip -o ${safeSrc} -d ${safeDest}`,
    'tar.gz':  `tar -xzf ${safeSrc} -C ${safeDest}`,
    'tar.bz2': `tar -xjf ${safeSrc} -C ${safeDest}`,
    'tar.xz':  `tar -xJf ${safeSrc} -C ${safeDest}`,
    'tar':     `tar -xf ${safeSrc} -C ${safeDest}`,
    'gz':      `gunzip -k ${safeSrc}`,
    'bz2':     `bunzip2 -k ${safeSrc}`,
  };
  return commands[format] ?? null;
}

/**
 * Cek apakah tool kompresi tersedia di server remote.
 */
async function checkRemoteTool(
  sessionId: string,
  tool: string
): Promise<boolean> {
  try {
    const result = await sshManager.executeCommand(sessionId, `which ${tool} 2>/dev/null`);
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

export async function handleRemoteCompress(
  event: IpcMainInvokeEvent,
  opts: RemoteCompressOptions,
  mainWindow: BrowserWindow
): Promise<{ success: boolean; archivePath?: string; error?: string }> {
  try {
    // 1. Sanitasi input
    const safeSrc  = sanitizeRemotePath(opts.remotePath);
    const safeName = sanitizeArchiveName(opts.archiveName);
    const destPath = `${safeSrc.dirpath}/${safeName}`;
    const safeDest = JSON.stringify(destPath);

    // 2. Cek tool tersedia di server
    const toolName = opts.archiveType === 'zip' ? 'zip' : 'tar';
    const toolAvailable = await checkRemoteTool(opts.sessionId, toolName);

    if (!toolAvailable) {
      if (opts.archiveType === 'zip') {
        return {
          success: false,
          error: `Tool 'zip' tidak ditemukan di server. Gunakan format tar.gz sebagai alternatif.`
        };
      }
      return { success: false, error: `Tool '${toolName}' tidak ditemukan di server remote.` };
    }

    // 3. Kirim progress awal ke renderer
    mainWindow.webContents.send('archive:progress', {
      sessionId: opts.sessionId,
      phase: 'compressing',
      message: `Mengompresi ${safeSrc.basename}...`,
      percent: 0,
    });

    // 4. Jalankan perintah via SSH exec (streaming stderr untuk progress)
    const cmd = buildCompressCommand(safeSrc.quoted, safeDest, opts.archiveType);
    await sshManager.executeCommandWithStream(
      opts.sessionId,
      cmd,
      (stderr: string) => {
        mainWindow.webContents.send('archive:progress', {
          sessionId: opts.sessionId,
          phase: 'compressing',
          message: stderr.trim(),
          percent: -1, // indeterminate
        });
      }
    );

    // 5. Kirim sinyal selesai
    mainWindow.webContents.send('archive:progress', {
      sessionId: opts.sessionId,
      phase: 'done',
      message: `Arsip ${safeName} berhasil dibuat.`,
      percent: 100,
    });

    return { success: true, archivePath: destPath };

  } catch (err: any) {
    mainWindow.webContents.send('archive:progress', {
      sessionId: opts.sessionId,
      phase: 'error',
      message: err.message,
    });
    return { success: false, error: err.message };
  }
}

export async function handleRemoteExtract(
  event: IpcMainInvokeEvent,
  opts: RemoteExtractOptions,
  mainWindow: BrowserWindow
): Promise<{ success: boolean; error?: string }> {
  try {
    const safeArchive = sanitizeRemotePath(opts.archivePath);
    const format = detectArchiveFormat(safeArchive.basename);

    if (!format) {
      return { success: false, error: `Format arsip tidak dikenali: ${safeArchive.basename}` };
    }

    // Direktori tujuan default = direktori yang sama dengan arsip
    const rawDest = opts.destDir ?? safeArchive.dirpath;
    const safeDest = sanitizeRemotePath(rawDest);

    const cmd = buildExtractCommand(safeArchive.quoted, safeDest.quoted, format);
    if (!cmd) {
      return { success: false, error: `Tidak ada perintah ekstraksi untuk format: ${format}` };
    }

    // Pastikan direktori tujuan ada (mkdir -p aman karena sudah di-sanitasi)
    await sshManager.executeCommand(
      opts.sessionId,
      `mkdir -p ${safeDest.quoted}`
    );

    mainWindow.webContents.send('archive:progress', {
      sessionId: opts.sessionId,
      phase: 'extracting',
      message: `Mengekstrak ${safeArchive.basename}...`,
      percent: 0,
    });

    await sshManager.executeCommandWithStream(
      opts.sessionId,
      cmd,
      (stderr: string) => {
        mainWindow.webContents.send('archive:progress', {
          sessionId: opts.sessionId,
          phase: 'extracting',
          message: stderr.trim(),
          percent: -1,
        });
      }
    );

    mainWindow.webContents.send('archive:progress', {
      sessionId: opts.sessionId,
      phase: 'done',
      message: `Ekstraksi selesai ke ${safeDest.basename || rawDest}`,
      percent: 100,
    });

    return { success: true };

  } catch (err: any) {
    mainWindow.webContents.send('archive:progress', {
      sessionId: opts.sessionId,
      phase: 'error',
      message: err.message,
    });
    return { success: false, error: err.message };
  }
}

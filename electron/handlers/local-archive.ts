import { IpcMainInvokeEvent, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import archiver from 'archiver'
import * as tar from 'tar'
import * as unzipper from 'unzipper'
import { validateExtractEntry } from '../utils/shell-sanitizer'

export interface LocalCompressOptions {
  sourcePath: string;
  outputPath: string;
  archiveType: 'zip' | 'tar.gz';
  compressionLevel?: number; // 1-9, default 6
}

export interface LocalExtractOptions {
  archivePath: string;
  destDir: string;
  overwrite?: boolean; // default false
}

/**
 * Kompresi file/folder lokal menggunakan archiver (streaming).
 *
 * archiver mendukung event 'progress' untuk melaporkan kemajuan byte-per-byte.
 * Referensi: https://www.archiverjs.com/docs/archiver/
 */
export async function handleLocalCompress(
  event: IpcMainInvokeEvent,
  opts: LocalCompressOptions,
  mainWindow: BrowserWindow
): Promise<{ success: boolean; outputPath?: string; error?: string }> {
  return new Promise((resolve) => {
    try {
      // Validasi source path ada
      if (!fs.existsSync(opts.sourcePath)) {
        return resolve({ success: false, error: `Source tidak ditemukan: ${opts.sourcePath}` });
      }

      const outputStream = fs.createWriteStream(opts.outputPath);
      const level = opts.compressionLevel ?? 6;

      let archive: archiver.Archiver;

      if (opts.archiveType === 'zip') {
        archive = archiver('zip', { zlib: { level } });
      } else {
        archive = archiver('tar', { gzip: true, gzipOptions: { level } });
      }

      // ── Error handling ─────────────────────────────────────────────
      archive.on('warning', (err) => {
        if (err.code !== 'ENOENT') {
          mainWindow.webContents.send('archive:progress', {
            phase: 'warning',
            message: err.message,
          });
        }
      });

      archive.on('error', (err) => {
        mainWindow.webContents.send('archive:progress', {
          phase: 'error',
          message: err.message,
        });
        resolve({ success: false, error: err.message });
      });

      // ── Progress streaming ke renderer via IPC ──────────────────────
      // Referensi Electron IPC: https://www.electronjs.org/docs/latest/tutorial/ipc
      archive.on('progress', (progressData) => {
        const percent = progressData.entries.total > 0
          ? Math.round((progressData.entries.processed / progressData.entries.total) * 100)
          : 0;
        mainWindow.webContents.send('archive:progress', {
          phase: 'compressing',
          message: `${progressData.entries.processed} / ${progressData.entries.total} file`,
          percent,
          bytesProcessed: progressData.fs.processedBytes,
        });
      });

      // ── Selesai ─────────────────────────────────────────────────────
      outputStream.on('close', () => {
        mainWindow.webContents.send('archive:progress', {
          phase: 'done',
          message: `Arsip dibuat: ${path.basename(opts.outputPath)}`,
          percent: 100,
        });
        resolve({ success: true, outputPath: opts.outputPath });
      });

      archive.pipe(outputStream);

      // Tambahkan source (file atau folder)
      const stat = fs.statSync(opts.sourcePath);
      if (stat.isDirectory()) {
        archive.directory(opts.sourcePath, path.basename(opts.sourcePath));
      } else {
        archive.file(opts.sourcePath, { name: path.basename(opts.sourcePath) });
      }

      archive.finalize();

    } catch (err: any) {
      resolve({ success: false, error: err.message });
    }
  });
}

/**
 * Ekstraksi arsip lokal dengan proteksi ZIP Slip.
 *
 * Setiap entry path divalidasi agar tidak keluar dari destDir
 * (proteksi terhadap directory traversal / ZIP Slip attack).
 * Referensi: https://en.wikipedia.org/wiki/Directory_traversal_attack
 */
export async function handleLocalExtract(
  event: IpcMainInvokeEvent,
  opts: LocalExtractOptions,
  mainWindow: BrowserWindow
): Promise<{ success: boolean; error?: string }> {
  try {
    const archivePath = opts.archivePath;
    const destDir = opts.destDir;
    const lower = archivePath.toLowerCase();

    // Pastikan direktori tujuan ada
    fs.mkdirSync(destDir, { recursive: true });

    mainWindow.webContents.send('archive:progress', {
      phase: 'extracting',
      message: `Mengekstrak ${path.basename(archivePath)}...`,
      percent: 0,
    });

    if (lower.endsWith('.zip')) {
      // ── ZIP extraction dengan unzipper (stream-based, aman RAM) ────
      await new Promise<void>((resolve, reject) => {
        let count = 0;
        fs.createReadStream(archivePath)
          .pipe(unzipper.Parse())
          .on('entry', (entry: any) => {
            const entryPath: string = entry.path;

            // Proteksi ZIP Slip
            try {
              validateExtractEntry(entryPath, destDir);
            } catch (e: any) {
              entry.autodrain();
              reject(e);
              return;
            }

            const fullPath = path.join(destDir, entryPath);

            if (entry.type === 'Directory') {
              fs.mkdirSync(fullPath, { recursive: true });
              entry.autodrain();
            } else {
              fs.mkdirSync(path.dirname(fullPath), { recursive: true });
              entry.pipe(fs.createWriteStream(fullPath))
                .on('error', reject);
            }

            count++;
            mainWindow.webContents.send('archive:progress', {
              phase: 'extracting',
              message: entryPath,
              percent: -1, // indeterminate karena ZIP tidak menyimpan total entries di header
            });
          })
          .on('error', reject)
          .on('finish', () => {
            mainWindow.webContents.send('archive:progress', {
              phase: 'done',
              message: `${count} file diekstrak.`,
              percent: 100,
            });
            resolve();
          });
      });

    } else if (
      lower.endsWith('.tar.gz') ||
      lower.endsWith('.tgz') ||
      lower.endsWith('.tar.bz2') ||
      lower.endsWith('.tar.xz') ||
      lower.endsWith('.tar')
    ) {
      // ── TAR extraction menggunakan node-tar (dipakai oleh npm CLI) ──
      // Referensi: https://www.npmjs.com/package/tar
      await tar.extract({
        file: archivePath,
        cwd: destDir,
        // strip: 0 — pertahankan struktur folder asli
        onentry: (entry: any) => {
          // Proteksi path traversal bawaan node-tar aktif secara default
          mainWindow.webContents.send('archive:progress', {
            phase: 'extracting',
            message: entry.path,
            percent: -1,
          });
        },
      });

      mainWindow.webContents.send('archive:progress', {
        phase: 'done',
        message: `Ekstraksi TAR selesai.`,
        percent: 100,
      });

    } else {
      return { success: false, error: `Format tidak didukung untuk ekstraksi lokal: ${path.basename(archivePath)}` };
    }

    return { success: true };

  } catch (err: any) {
    mainWindow.webContents.send('archive:progress', {
      phase: 'error',
      message: err.message,
    });
    return { success: false, error: err.message };
  }
}

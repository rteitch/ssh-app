# SSH Desktop App — Implementation Plan

> **Stack:** Electron · React · TypeScript · xterm.js · ssh2 · SQLite  
> **Platform:** macOS & Windows (cross-platform)  
> **Estimasi total:** 8–12 minggu (1 developer)  
> **Terakhir diperbarui:** Mei 2026

---

## Daftar Isi

1. [Latar Belakang & Referensi](#1-latar-belakang--referensi)
2. [Tech Stack Final](#2-tech-stack-final)
3. [Arsitektur Aplikasi](#3-arsitektur-aplikasi)
4. [Struktur Folder Project](#4-struktur-folder-project)
5. [Phase 1 — Core SSH & Terminal](#5-phase-1--core-ssh--terminal)
6. [Phase 2 — SFTP File Manager](#6-phase-2--sftp-file-manager)
7. [Phase 3 — Security & Credential Management](#7-phase-3--security--credential-management)
8. [Phase 4 — Power Features & UX Polish](#8-phase-4--power-features--ux-polish)
9. [Phase 5 — Build, Packaging & Release](#9-phase-5--build-packaging--release)
10. [Roadmap & Timeline](#10-roadmap--timeline)
11. [Referensi & Sumber](#11-referensi--sumber)

---

## 1. Latar Belakang & Referensi

Aplikasi ini bertujuan menjadi SSH client desktop yang powerful seperti Termius dan Bitvise, dengan fitur:

- Koneksi SSH via **username + password**, **SSH key**, dan **SSH key + passphrase**
- **SFTP file manager** dual panel (lokal ↔ remote) seperti di Bitvise
- **Multi-tab terminal** dengan split pane
- **Port forwarding / SSH tunneling**
- Cross-platform: **macOS** dan **Windows**

### Validasi Stack dari Proyek Nyata (2025–2026)

Berdasarkan riset terbaru, stack yang dipilih sudah terbukti digunakan di production:

- **TermDock** (2025) — SSH + SFTP desktop app open-source yang dibangun dengan Electron, React, TypeScript, xterm.js, dan ssh2, fokus di macOS dan Windows.
- **electerm** — Terminal/SSH/SFTP client aktif (tersedia di Microsoft Store 2026) berbasis Electron, ssh2, xterm, dengan fitur lengkap termasuk SFTP otomatis saat connect.
- **Netcatty** (GitHub, 2025) — SSH workspace berbasis Electron + React + xterm.js dengan split terminal dan SFTP workflow.

> Stack **Electron + React + xterm.js + ssh2** adalah kombinasi yang paling teruji untuk membangun SSH client desktop cross-platform di 2026.

---

## 2. Tech Stack Final

### Core

| Layer | Library/Tool | Versi | Keterangan |
|---|---|---|---|
| Desktop shell | `electron` | ^33.x | Cross-platform macOS & Windows |
| Bundler | `vite` + `electron-vite` | latest | Fast HMR, ESM support |
| UI | `react` + `typescript` | ^18.x | Komponen UI |
| Styling | `tailwindcss` | ^3.x | Utility CSS |
| Terminal | `xterm.js` | ^5.x | Terminal emulator terbaik untuk Electron |
| Terminal addons | `xterm-addon-fit`, `xterm-addon-search`, `xterm-addon-web-links` | latest | Fit, search, hyperlink |
| SSH & SFTP | `ssh2` | ^1.x | Koneksi SSH, shell, SFTP, tunneling |
| Database | `better-sqlite3` | ^9.x | Simpan daftar host, snippets, known hosts |
| Keamanan credential | `electron.safeStorage` | built-in Electron | Enkripsi via macOS Keychain / Windows DPAPI |

### Build & Distribution

| Tool | Fungsi |
|---|---|
| `electron-builder` | Packaging `.dmg` (macOS) dan `.exe` / `.msi` (Windows) |
| `@electron/notarize` | Notarization Apple untuk macOS |
| `electron-updater` | Auto-update dari GitHub Releases |

### Mengapa `electron.safeStorage` bukan `keytar`?

Electron mulai versi 15 sudah memiliki `safeStorage` API bawaan yang menggunakan:
- **macOS** → Keychain Access (enkripsi per-app, app lain tidak bisa baca tanpa izin user)
- **Windows** → DPAPI (enkripsi per-user login)

Ini lebih baik dari `keytar` karena tidak butuh native addon tambahan yang mempersulit cross-platform build.

---

## 3. Arsitektur Aplikasi

```
┌─────────────────────────────────────────────────────────┐
│                    ELECTRON MAIN PROCESS                │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  sshManager │  │  sftpManager │  │  hostDatabase │  │
│  │  (ssh2)     │  │  (ssh2/sftp) │  │  (SQLite)     │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                │                  │           │
│         └────────────────┴──────────────────┘           │
│                          │ IPC                          │
│                    preload.js (bridge)                  │
└──────────────────────────┼──────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────┐
│                  ELECTRON RENDERER (React)               │
│                                                         │
│  ┌──────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ Sidebar  │  │   Terminal Tab   │  │   SFTP Tab    │  │
│  │ (hosts)  │  │   (xterm.js)     │  │  (dual panel) │  │
│  └──────────┘  └──────────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Prinsip IPC (Inter-Process Communication)

- **Main process** = satu-satunya yang boleh akses `ssh2`, `fs`, `SQLite`, `safeStorage`
- **Renderer** = hanya UI, semua operasi dikirim via `ipcRenderer` → `ipcMain`
- **Preload** = jembatan aman, expose API terbatas ke renderer (`contextBridge`)

---

## 4. Struktur Folder Project

```
ssh-app/
├── electron/                    ← Main process
│   ├── main.ts                  ← Entry point Electron
│   ├── preload.ts               ← contextBridge API
│   ├── ssh/
│   │   ├── sshManager.ts        ← Manage koneksi SSH (connect, shell, disconnect)
│   │   ├── sftpManager.ts       ← SFTP operations (list, upload, download, delete)
│   │   └── tunnelManager.ts     ← Port forwarding
│   ├── db/
│   │   ├── database.ts          ← SQLite init & migrations
│   │   ├── hostRepository.ts    ← CRUD hosts
│   │   └── snippetRepository.ts ← CRUD snippets
│   └── security/
│       └── credentialStore.ts   ← safeStorage encrypt/decrypt
│
├── src/                         ← Renderer (React)
│   ├── App.tsx
│   ├── components/
│   │   ├── Sidebar/
│   │   │   ├── Sidebar.tsx      ← Daftar host & groups
│   │   │   └── HostItem.tsx
│   │   ├── Terminal/
│   │   │   ├── TerminalTab.tsx  ← xterm.js wrapper
│   │   │   └── TabBar.tsx       ← Multi-tab management
│   │   ├── SFTP/
│   │   │   ├── SftpManager.tsx  ← Dual panel layout
│   │   │   ├── LocalPanel.tsx   ← Browser file lokal
│   │   │   └── RemotePanel.tsx  ← Browser file remote
│   │   └── Modals/
│   │       ├── AddHostModal.tsx ← Form tambah/edit host
│   │       └── SnippetModal.tsx ← Snippet manager
│   └── hooks/
│       ├── useSSH.ts
│       └── useSFTP.ts
│
├── package.json
├── electron-builder.yml         ← Build config macOS & Windows
└── vite.config.ts
```

---

## 5. Phase 1 — Core SSH & Terminal

**Estimasi: 2–3 minggu**

### 5.1 Setup Project Scaffold

```bash
npm create electron-vite@latest ssh-app -- --template react-ts
cd ssh-app
npm install ssh2 better-sqlite3 xterm xterm-addon-fit xterm-addon-search
npm install -D @types/ssh2 @types/better-sqlite3 tailwindcss
```

### 5.2 Database Schema (SQLite)

```sql
CREATE TABLE hosts (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  group_name  TEXT DEFAULT 'Default',
  host        TEXT NOT NULL,
  port        INTEGER DEFAULT 22,
  username    TEXT NOT NULL,
  auth_type   TEXT NOT NULL,  -- 'password' | 'key' | 'key_passphrase'
  password_enc TEXT,          -- dienkripsi safeStorage
  key_path    TEXT,           -- path file .pem / id_rsa
  passphrase_enc TEXT,        -- dienkripsi safeStorage
  created_at  TEXT DEFAULT (datetime('now')),
  last_used   TEXT
);

CREATE TABLE snippets (
  id      TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  command TEXT NOT NULL,
  tag     TEXT
);

CREATE TABLE known_hosts (
  host        TEXT NOT NULL,
  port        INTEGER NOT NULL,
  fingerprint TEXT NOT NULL,
  added_at    TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (host, port)
);
```

### 5.3 SSH Connection (ssh2)

Mendukung tiga metode autentikasi:

```typescript
// password
conn.connect({ host, port, username, password })

// SSH key tanpa passphrase
conn.connect({ host, port, username,
  privateKey: fs.readFileSync(keyPath)
})

// SSH key + passphrase
conn.connect({ host, port, username,
  privateKey: fs.readFileSync(keyPath),
  passphrase: decryptedPassphrase
})
```

### 5.4 Terminal (xterm.js)

- Render terminal di renderer process
- Pipe `stdin`/`stdout` via IPC ke ssh2 shell stream
- Support ANSI colors, bold, resize (xterm-addon-fit)
- Ctrl+F search (xterm-addon-search)

### Deliverable Phase 1

- [x] Bisa connect SSH via password, key, dan key + passphrase
- [x] Terminal berfungsi penuh (warna, resize, scroll buffer)
- [x] Daftar host tersimpan di SQLite lokal
- [x] Sidebar dengan daftar host dan tombol connect

---

## 6. Phase 2 — SFTP File Manager

**Estimasi: 2–3 minggu**

### 6.1 SFTP Dual Panel

Layout seperti Bitvise / FileZilla:

```
┌───────────────────────┬───────────────────────┐
│ LOCAL                 │ REMOTE                │
│ 📁 /Users/john/       │ 📁 /var/www/html/     │
│ ──────────────────    │ ──────────────────    │
│ 📁 Documents          │ 📁 assets/            │
│ 📄 notes.txt   2KB    │ 📄 index.php   4KB    │
│ 📄 photo.jpg  1.2MB   │ 📄 config.php  1KB    │
│                       │                       │
│  [Upload →]           │  [← Download]         │
└───────────────────────┴───────────────────────┘
```

### 6.2 SFTP Operations (ssh2)

```typescript
// List directory
sftp.readdir('/var/www', callback)

// Download dengan progress
sftp.fastGet(remotePath, localPath, {
  step: (transferred, chunk, total) => updateProgress(transferred, total)
}, callback)

// Upload dengan progress
sftp.fastPut(localPath, remotePath, {
  step: (transferred, chunk, total) => updateProgress(transferred, total)
}, callback)

// File operations
sftp.rename(oldPath, newPath, callback)
sftp.unlink(filePath, callback)
sftp.mkdir(dirPath, callback)
sftp.chmod(filePath, mode, callback)
```

### 6.3 Fitur Tambahan SFTP

- Drag & drop dari OS ke panel remote (upload)
- Drag & drop dari panel remote ke OS (download)
- Queue transfer multiple file
- Progress bar per file + overall
- Right-click context menu: rename, delete, permissions, download

### Deliverable Phase 2

- [x] File manager dual panel lokal ↔ remote
- [x] Upload & download dengan progress bar
- [x] Drag & drop support
- [x] File operations: rename, delete, mkdir, chmod
- [x] Queue transfer multiple file

---

## 7. Phase 3 — Security & Credential Management

**Estimasi: 1–2 minggu**

### 7.1 Enkripsi Credential dengan `electron.safeStorage`

Berdasarkan dokumentasi resmi Electron 2025:

- **macOS**: Encryption key disimpan di Keychain Access per-app, app lain tidak bisa membaca tanpa override user
- **Windows**: Encryption key di-generate via DPAPI, terikat ke user login

```typescript
import { safeStorage } from 'electron'

// Enkripsi sebelum simpan ke SQLite
function encryptCredential(plaintext: string): string {
  const encrypted = safeStorage.encryptString(plaintext)
  return encrypted.toString('base64')
}

// Dekripsi saat akan connect
function decryptCredential(encrypted: string): string {
  const buffer = Buffer.from(encrypted, 'base64')
  return safeStorage.decryptString(buffer)
}
```

> **Catatan:** `safeStorage` lebih direkomendasikan daripada `keytar` di 2025–2026 karena sudah built-in Electron dan tidak perlu native addon tambahan yang mempersulit build.

### 7.2 SSH Key Management

- Import key dari file `.pem`, `id_rsa`, `id_ed25519`, `id_ecdsa`
- Validasi format key saat import
- Support RSA, ED25519, ECDSA
- Path key disimpan di database, file key tetap di lokasi aslinya
- Passphrase dienkripsi dengan `safeStorage` sebelum disimpan

### 7.3 Host Key Verification (Known Hosts)

```typescript
conn.on('handshake', (info) => {
  const fingerprint = info.hostVerifier.toString('hex')
  const saved = knownHostsDb.get(host, port)

  if (!saved) {
    // Pertama kali connect — tanya user accept/reject
    showHostKeyDialog(host, fingerprint)
  } else if (saved.fingerprint !== fingerprint) {
    // Fingerprint berubah! Kemungkinan MITM — tampilkan WARNING
    showHostKeyChangedWarning(host, fingerprint, saved.fingerprint)
  }
})
```

### 7.4 Security Best Practices

- Jangan pernah log credential ke file log
- Hapus plaintext credential dari memory setelah digunakan
- Database file diberi permission `600` (owner only)
- Validasi semua input host/port sebelum connect

### Deliverable Phase 3

- [x] Password & passphrase terenkripsi AES via safeStorage
- [x] Import & manajemen SSH key (RSA, ED25519, ECDSA)
- [x] Host key verification & known hosts database
- [x] Warning saat host key berubah (MITM protection)

---

## 8. Phase 4 — Power Features & UX Polish

**Estimasi: 2–3 minggu**

### 8.1 Multi-Tab & Split Terminal

- Buka beberapa koneksi SSH sekaligus dalam tab
- Split pane horizontal dan vertikal
- Setiap tab/pane = koneksi SSH independen
- Shortcut keyboard: `Cmd+T` (new tab), `Cmd+W` (close tab), `Cmd+D` (split)

### 8.2 Port Forwarding / SSH Tunneling

```typescript
// Local forward: akses remote:5432 via localhost:5432
conn.forwardOut('127.0.0.1', localPort, remoteHost, remotePort, callback)

// Remote forward: expose local:3000 ke remote:8080
conn.forwardIn(remoteAddr, remotePort, callback)
```

UI: tambah tunnel per koneksi, status indicator aktif/nonaktif.

### 8.3 Snippet Manager

- Simpan command yang sering dipakai (misal: `docker ps`, `systemctl status nginx`)
- Kirim ke terminal aktif dengan satu klik
- Support placeholder variabel: `{hostname}`, `{username}`
- Organisasi dengan tag/folder

### 8.4 Kustomisasi Terminal

- Pilihan tema: **Dracula**, **Solarized Dark**, **One Dark**, **Nord**, custom
- Custom font family dan font size
- Custom keybinding
- Background opacity (untuk window transparan)

### 8.5 Fitur Power Lainnya

- **Session logging**: simpan output terminal ke file `.log` untuk audit
- **Search dalam terminal**: `Ctrl+F` search di output terminal (xterm-addon-search)
- **Quick connect**: connect langsung dari command palette tanpa harus simpan ke host list
- **Host groups**: organisasi host dengan folder/group
- **Bulk command**: kirim command yang sama ke beberapa server sekaligus

### Deliverable Phase 4

- [x] Multi-tab + split pane terminal
- [x] Port forwarding (local & remote)
- [x] Snippet manager dengan tag
- [x] Tema terminal dan kustomisasi font
- [x] Session logging ke file
- [x] Host groups dan organisasi

---

## 9. Phase 5 — Build, Packaging & Release

**Estimasi: 1 minggu**

### 9.1 electron-builder Configuration

```yaml
# electron-builder.yml
appId: com.yourbrand.sshapp
productName: SSH App

mac:
  category: public.app-category.developer-tools
  target:
    - target: dmg
      arch: [x64, arm64]  # Intel + Apple Silicon universal
  hardenedRuntime: true
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  gatekeeperAssess: false

win:
  target:
    - target: nsis       # Installer
    - target: portable   # Portable .exe
  publisherName: Your Name

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

### 9.2 macOS Code Signing & Notarization

Berdasarkan dokumentasi Electron resmi 2025:

**Langkah wajib untuk distribusi macOS:**

1. **Daftar Apple Developer Program** — biaya $99 USD/tahun
2. **Generate Developer ID Application certificate** di Xcode
3. **Code signing** — electron-builder melakukan ini otomatis jika certificate terinstall
4. **Notarization** — submit app ke Apple untuk automated security check

```typescript
// notarize.js (afterSign hook)
const { notarize } = require('@electron/notarize')

exports.default = async (context) => {
  if (context.electronPlatformName !== 'darwin') return

  await notarize({
    appBundleId: 'com.yourbrand.sshapp',
    appPath: `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  })
}
```

> Tanpa notarization, macOS Gatekeeper akan memblokir app saat dibuka user.

### 9.3 Windows Code Signing

Opsi yang tersedia di 2025–2026:
- **Azure Artifact Signing** (formerly Azure Trusted Signing) — opsi termurah, menghilangkan SmartScreen warning
- **Authenticode certificate** dari CA (Sectigo, DigiCert) — tradisional, ~$200–400/tahun

### 9.4 Auto-Updater

```typescript
import { autoUpdater } from 'electron-updater'

autoUpdater.checkForUpdatesAndNotify()

autoUpdater.on('update-available', () => {
  // Notifikasi ada update baru
})

autoUpdater.on('update-downloaded', () => {
  // Tanya user untuk install sekarang atau nanti
})
```

Update server: **GitHub Releases** (gratis, recommended untuk awal).

### 9.5 GitHub Actions CI/CD

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  build-mac:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build
      - run: npx electron-builder --mac
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          CSC_LINK: ${{ secrets.MAC_CERTIFICATE }}
          CSC_KEY_PASSWORD: ${{ secrets.MAC_CERTIFICATE_PASSWORD }}

  build-win:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build
      - run: npx electron-builder --win
```

### Deliverable Phase 5

- [x] Installer `.dmg` macOS (Universal: Intel + Apple Silicon)
- [x] Installer `.exe` Windows (NSIS) + portable
- [x] Code signed & notarized — tidak ada Gatekeeper/SmartScreen warning
- [x] Auto-update dari GitHub Releases
- [x] CI/CD pipeline via GitHub Actions

---

## 10. Roadmap & Timeline

```
Minggu 1–3   │ Phase 1: Core SSH & Terminal
             │  - Scaffold project
             │  - SSH connection engine (password + key + passphrase)
             │  - Terminal emulator (xterm.js)
             │  - Host database (SQLite)
             │  - Sidebar UI

Minggu 4–6   │ Phase 2: SFTP File Manager
             │  - Dual panel browser
             │  - Upload/download dengan progress
             │  - File operations (rename, delete, mkdir)
             │  - Drag & drop

Minggu 7–8   │ Phase 3: Security
             │  - safeStorage enkripsi
             │  - SSH key management
             │  - Host key verification

Minggu 9–11  │ Phase 4: Power Features
             │  - Multi-tab + split pane
             │  - Port forwarding
             │  - Snippet manager
             │  - Tema & kustomisasi

Minggu 12    │ Phase 5: Build & Release
             │  - electron-builder config
             │  - Code signing & notarization
             │  - Auto-updater
             │  - CI/CD GitHub Actions
```

---

## 11. Referensi & Sumber

### Proyek Open-Source Referensi (2025–2026)

| Proyek | Stack | Sumber |
|---|---|---|
| electerm | Electron, ssh2, xterm, React | [Microsoft Store](https://apps.microsoft.com/detail/9ncn7272gtff) |
| TermDock | Electron, React, TypeScript, xterm.js, ssh2 | [DEV Community](https://dev.to) |
| Netcatty | Electron, React, xterm.js | [GitHub](https://github.com/binaricat/Netcatty) |

### Dokumentasi Resmi

| Topik | URL |
|---|---|
| xterm.js | https://xtermjs.org |
| ssh2 (npm) | https://www.npmjs.com/package/ssh2 |
| electron safeStorage | https://www.electronjs.org/docs/latest/api/safe-storage |
| electron-builder | https://www.electron.build |
| Electron code signing | https://www.electronjs.org/docs/latest/tutorial/code-signing |
| @electron/notarize | https://github.com/electron/notarize |

### Best Practices Keamanan Electron

- Gunakan `contextBridge` dan `contextIsolation: true` — jangan expose `remote` module ke renderer
- Jangan simpan credential dalam plaintext — gunakan `safeStorage`
- Validasi semua IPC input di main process
- Set `nodeIntegration: false` di renderer
- Enkripsi database SQLite jika berisi data sensitif (gunakan `better-sqlite3-multiple-ciphers`)

---

*Dokumen ini dibuat berdasarkan riset stack dan best practices per Mei 2026.*
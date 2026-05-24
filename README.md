# SSH App

SSH desktop client dengan SFTP file manager, dibangun menggunakan Electron + React + TypeScript.

**Developed by Rteitch** · Version 1.0

## Tech Stack

| Layer | Library | Versi |
|---|---|---|
| Desktop | Electron | 28.x |
| UI | React + TypeScript | 19.x |
| Styling | Tailwind CSS | 4.x |
| Terminal | xterm.js | 6.x |
| SSH & SFTP | ssh2 | 1.x |
| Database | better-sqlite3 | 12.x |
| Credential | electron.safeStorage | Built-in |
| Bundler | electron-vite + Vite | 5.x / 7.x |

## Fitur

### Koneksi SSH
- Autentikasi via **Password**, **SSH Key**, dan **SSH Key + Passphrase**
- Support RSA, ED25519, ECDSA key formats
- Host key verification & known hosts database

### Terminal
- xterm.js terminal emulator dengan full ANSI colors
- **Multi-tab** — buka beberapa koneksi SSH sekaligus
- Resize otomatis, scroll buffer, search (Ctrl+F)
- Web links clickable

### Host Management
- Simpan, edit, hapus host di SQLite lokal
- Organisasi host dengan **groups/folders**
- Search host di sidebar
- Quick Connect dari welcome screen

### SFTP File Manager
- List, upload, download, delete, mkdir, rename, chmod
- Transfer progress tracking

### UI/UX
- **macOS native feel** — vibrancy, hidden titlebar, traffic lights integration
- **Responsive layout** — collapsible sidebar (Ctrl+B)
- **Dark theme** — Catppuccin Mocha color scheme
- Animasi dan hover effects yang halus
- Keyboard shortcuts

### Keamanan
- Password & passphrase terenkripsi via `electron.safeStorage` (macOS Keychain / Windows DPAPI)
- Context isolation & sandbox mode
- Input validation

## Keyboard Shortcuts

| Shortcut | Fungsi |
|---|---|
| `Ctrl+N` | Tambah host baru |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+T` | Tab baru (saat ada koneksi) |
| `Ctrl+W` | Tutup tab |

## Cara Menjalankan

### Prerequisites

- Node.js >= 18
- npm
- Xcode Command Line Tools (macOS, untuk build native modules)

### Install

```bash
npm install
```

Native modules (`better-sqlite3`, `ssh2`) akan otomatis di-rebuild untuk Electron via `postinstall` script.

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview

```bash
npm run preview
```

## Struktur Project

```
ssh-app/
├── electron/                    ← Main process
│   ├── main.ts                  ← Entry point, IPC handlers, window config
│   ├── preload.ts               ← contextBridge API
│   ├── ssh/
│   │   ├── sshManager.ts        ← SSH connection management
│   │   └── sftpManager.ts       ← SFTP operations
│   ├── db/
│   │   ├── database.ts          ← SQLite schema & migrations
│   │   ├── hostRepository.ts    ← CRUD hosts
│   │   └── snippetRepository.ts ← CRUD snippets
│   └── security/
│       └── credentialStore.ts   ← safeStorage encrypt/decrypt
├── src/                         ← Renderer (React)
│   ├── App.tsx                  ← Main layout & state management
│   ├── main.tsx                 ← React entry point
│   ├── components/
│   │   ├── Sidebar/
│   │   │   └── Sidebar.tsx      ← Host list, search, groups
│   │   ├── Terminal/
│   │   │   ├── TabBar.tsx       ← Multi-tab management
│   │   │   └── TerminalTab.tsx  ← xterm.js wrapper
│   │   └── Modals/
│   │       └── AddHostModal.tsx ← Add/edit host form
│   ├── styles/
│   │   └── index.css            ← Global styles & CSS variables
│   └── types/
│       ├── index.ts             ← TypeScript interfaces
│       └── css.d.ts             ← CSS module declarations
├── index.html                   ← HTML entry point
├── package.json
├── electron.vite.config.ts      ← Build configuration
├── tailwind.config.js           ← Tailwind CSS config
├── postcss.config.js            ← PostCSS config
└── tsconfig.json                ← TypeScript config
```

## Arsitektur

```
┌─────────────────────────────────────────────────────────┐
│                    ELECTRON MAIN PROCESS                │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  sshManager │  │  sftpManager │  │  hostDatabase │  │
│  │  (ssh2)     │  │  (ssh2/sftp) │  │  (SQLite)     │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│         └────────────────┴──────────────────┘           │
│                          │ IPC                          │
│                    preload.js (bridge)                  │
└──────────────────────────┼──────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────┐
│                  ELECTRON RENDERER (React)               │
│                                                         │
│  ┌──────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ Sidebar  │  │   Terminal Tab   │  │   Status Bar  │  │
│  │ (hosts)  │  │   (xterm.js)     │  │               │  │
│  └──────────┘  └──────────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Warna Tema (Catppuccin Mocha)

| Variable | Warna | Penggunaan |
|---|---|---|
| `--bg-primary` | `#1e1e2e` | Background utama |
| `--bg-secondary` | `#181825` | Sidebar, status bar |
| `--bg-surface` | `#313244` | Card, input, hover |
| `--accent` | `#89b4fa` | Primary accent (biru) |
| `--success` | `#a6e3a1` | Status online, connect |
| `--error` | `#f38ba8` | Error, close, delete |
| `--text-primary` | `#cdd6f4` | Teks utama |
| `--text-muted` | `#585b70` | Teks sekunder |

## License

MIT

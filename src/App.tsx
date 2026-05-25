import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import TerminalTab from './components/Terminal/TerminalTab'
import TabBar from './components/Terminal/TabBar'
import AddHostModal from './components/Modals/AddHostModal'
import SftpManager from './components/SFTP/SftpManager'
import type { Host, Snippet } from './types'

type ViewMode = 'terminal' | 'sftp'

interface Tab {
  id: string
  hostId: string
  hostName: string
  sessionId: string
  connected: boolean
}

declare global {
  interface Window {
    sshApi: {
      getHosts: () => Promise<Host[]>
      getHost: (id: string) => Promise<Host | undefined>
      createHost: (host: any) => Promise<Host>
      updateHost: (id: string, host: any) => Promise<Host | undefined>
      deleteHost: (id: string) => Promise<boolean>
      connect: (sessionId: string, config: any) => Promise<void>
      disconnect: (sessionId: string) => Promise<void>
      isConnected: (sessionId: string) => Promise<boolean>
      openShell: (sessionId: string) => Promise<boolean>
      writeToShell: (sessionId: string, data: string) => Promise<void>
      resizeShell: (sessionId: string, cols: number, rows: number) => Promise<void>
      onShellData: (sessionId: string, callback: (data: string) => void) => () => void
      onShellClose: (sessionId: string, callback: () => void) => () => void
      sftpList: (sessionId: string, remotePath: string) => Promise<any[]>
      sftpDownload: (sessionId: string, remotePath: string, localPath: string) => Promise<void>
      sftpUpload: (sessionId: string, localPath: string, remotePath: string) => Promise<void>
      sftpDelete: (sessionId: string, remotePath: string) => Promise<void>
      sftpMkdir: (sessionId: string, remotePath: string) => Promise<void>
      sftpRename: (sessionId: string, oldPath: string, newPath: string) => Promise<void>
      sftpChmod: (sessionId: string, remotePath: string, mode: number) => Promise<void>
      sftpCancel: (sessionId: string, remotePath: string, direction: string) => Promise<boolean>
      sftpCancelAll: (sessionId: string) => Promise<number>
      getKnownHosts: () => Promise<any[]>
      removeKnownHost: (host: string, port: number) => Promise<boolean>
      getSnippets: () => Promise<any[]>
      createSnippet: (snippet: any) => Promise<any>
      updateSnippet: (id: string, snippet: any) => Promise<any>
      deleteSnippet: (id: string) => Promise<boolean>
      showOpenDialog: (options: any) => Promise<any>
      showSaveDialog: (options: any) => Promise<any>
      fsListLocal: (path: string) => Promise<any[]>
      fsGetHomeDir: () => Promise<string>
      fsDeleteLocal: (path: string) => Promise<boolean>
      fsMkdirLocal: (path: string) => Promise<boolean>
      fsRenameLocal: (oldPath: string, newPath: string) => Promise<boolean>
      fsExistsLocal: (path: string) => Promise<boolean>
      onTransferProgress: (callback: (progress: any) => void) => () => void
    }
  }
}

/* ─── SVG Icons ───────────────────────────── */
const TerminalBigIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="url(#grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#89b4fa" />
        <stop offset="100%" stopColor="#89dceb" />
      </linearGradient>
    </defs>
    <rect x="2" y="3" width="20" height="18" rx="2" ry="2"/>
    <polyline points="6 9 10 13 6 17"/>
    <line x1="14" y1="17" x2="18" y2="17"/>
  </svg>
)

const SftpBigIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="url(#grad2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <defs>
      <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#a6e3a1" />
        <stop offset="100%" stopColor="#89dceb" />
      </linearGradient>
    </defs>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    <polyline points="12 10 12 16"/>
    <polyline points="9 13 12 16 15 13"/>
  </svg>
)

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

const ServerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
  </svg>
)

const WifiIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>
  </svg>
)

const CodeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
  </svg>
)

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const PlayIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
)

const TrashSmallIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
)

/* ─── Main App Component ─────────────────── */
export default function App() {
  const [hosts, setHosts] = useState<Host[]>([])
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [showAddHost, setShowAddHost] = useState(false)
  const [editingHost, setEditingHost] = useState<Host | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('terminal')

  // Snippet drawer state
  const [showSnippetDrawer, setShowSnippetDrawer] = useState(false)
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [newSnippetName, setNewSnippetName] = useState('')
  const [newSnippetCmd, setNewSnippetCmd] = useState('')
  const [newSnippetTag, setNewSnippetTag] = useState('')

  const loadHosts = useCallback(async () => {
    const list = await window.sshApi.getHosts()
    setHosts(list)
  }, [])

  const loadSnippets = useCallback(async () => {
    try {
      const list = await window.sshApi.getSnippets()
      setSnippets(list)
    } catch { /* ignore if not available */ }
  }, [])

  useEffect(() => {
    loadHosts()
    loadSnippets()
  }, [loadHosts, loadSnippets])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault()
        setSidebarCollapsed(prev => !prev)
      }
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        setEditingHost(null)
        setShowAddHost(true)
      }
      // Ctrl+T — new tab (connect to most recently used host)
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault()
        if (hosts.length > 0) {
          const sorted = [...hosts].sort((a, b) => {
            if (!a.last_used && !b.last_used) return 0
            if (!a.last_used) return 1
            if (!b.last_used) return -1
            return new Date(b.last_used).getTime() - new Date(a.last_used).getTime()
          })
          handleConnect(sorted[0], 'terminal')
        } else {
          setEditingHost(null)
          setShowAddHost(true)
        }
      }
      // Ctrl+W — close active tab
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault()
        if (activeTab) {
          handleCloseTab(activeTab)
        }
      }
      // Ctrl+Shift+S to toggle between terminal and sftp
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        setViewMode(prev => (prev === 'terminal' ? 'sftp' : 'terminal'))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hosts, activeTab])

  const handleConnect = async (host: Host, defaultViewMode: 'terminal' | 'sftp' = 'terminal') => {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const newTab: Tab = {
      id: sessionId,
      hostId: host.id,
      hostName: host.name,
      sessionId,
      connected: false
    }

    setTabs(prev => [...prev, newTab])
    setActiveTab(sessionId)
    setViewMode(defaultViewMode)

    try {
      const config: any = {
        host: host.host,
        port: host.port,
        username: host.username,
        auth_type: host.auth_type,
        hostId: host.id
      }

      if (host.auth_type === 'password' && host.password_enc) {
        config.password = host.password_enc
      } else if (host.auth_type === 'key' && host.key_path) {
        config.key_path = host.key_path
      } else if (host.auth_type === 'key_passphrase' && host.key_path && host.passphrase_enc) {
        config.key_path = host.key_path
        config.passphrase = host.passphrase_enc
      }

      await window.sshApi.connect(sessionId, config)
      await window.sshApi.openShell(sessionId)

      setTabs(prev => prev.map(tab =>
        tab.id === sessionId ? { ...tab, connected: true } : tab
      ))
    } catch (err: any) {
      console.error('Connection failed:', err)
      alert(`Connection failed: ${err.message || err}`)
      setTabs(prev => prev.filter(tab => tab.id !== sessionId))
      if (activeTab === sessionId) {
        setActiveTab(tabs.length > 1 ? tabs[tabs.length - 2].id : null)
      }
    }
  }

  const handleCloseTab = async (tabId: string) => {
    try {
      await window.sshApi.disconnect(tabId)
    } catch {}
    setTabs(prev => prev.filter(tab => tab.id !== tabId))
    if (activeTab === tabId) {
      const remaining = tabs.filter(tab => tab.id !== tabId)
      setActiveTab(remaining.length > 0 ? remaining[remaining.length - 1].id : null)
    }
  }

  const handleSaveHost = async (hostData: any) => {
    try {
      if (editingHost) {
        await window.sshApi.updateHost(editingHost.id, hostData)
      } else {
        await window.sshApi.createHost(hostData)
      }
      await loadHosts()
      setShowAddHost(false)
      setEditingHost(null)
    } catch (err: any) {
      alert(`Failed to save host: ${err.message}`)
    }
  }

  const handleDeleteHost = async (id: string) => {
    if (confirm('Delete this host?')) {
      await window.sshApi.deleteHost(id)
      await loadHosts()
    }
  }

  const handleEditHost = (host: Host) => {
    setEditingHost(host)
    setShowAddHost(true)
  }

  // Snippet CRUD
  const handleAddSnippet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSnippetName.trim() || !newSnippetCmd.trim()) return
    try {
      await window.sshApi.createSnippet({ name: newSnippetName.trim(), command: newSnippetCmd.trim(), tag: newSnippetTag.trim() || undefined })
      setNewSnippetName('')
      setNewSnippetCmd('')
      setNewSnippetTag('')
      loadSnippets()
    } catch (err: any) {
      alert(`Failed to save snippet: ${err.message}`)
    }
  }

  const handleDeleteSnippet = async (id: string) => {
    try {
      await window.sshApi.deleteSnippet(id)
      loadSnippets()
    } catch {}
  }

  const handleRunSnippet = (command: string) => {
    if (activeTab) {
      window.sshApi.writeToShell(activeTab, command + '\n')
    }
  }

  const activeTabData = tabs.find(t => t.id === activeTab)
  const connectedCount = tabs.filter(t => t.connected).length

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <Sidebar
        hosts={hosts}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        onConnect={handleConnect}
        onAddHost={() => { setEditingHost(null); setShowAddHost(true) }}
        onEditHost={handleEditHost}
        onDeleteHost={handleDeleteHost}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TabBar
          tabs={tabs}
          activeTab={activeTab}
          viewMode={viewMode}
          onSelectTab={setActiveTab}
          onCloseTab={handleCloseTab}
          onViewModeChange={setViewMode}
        />

        <div className="flex-1 relative overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
          {tabs.length === 0 ? (
            /* Welcome Screen */
            <div className="welcome-container flex flex-col justify-center items-center py-10 px-6">
              <div className="welcome-content max-w-2xl w-full text-center animate-fade-in space-y-8">
                {/* Header */}
                <div>
                  <h2 className="text-4xl font-extrabold mb-2.5 gradient-text tracking-tight">SSH App</h2>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#a6adc8] mb-4">
                    Developed by Rteitch &middot; v1
                  </p>
                  <p className="text-sm max-w-md mx-auto text-[#cdd6f4]/80 leading-relaxed">
                    A premium, state-of-the-art SSH client and dual-panel SFTP file manager. Connect and manage your remote servers securely.
                  </p>
                </div>

                {/* Feature Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                  {/* Card 1: Terminal */}
                  <div className="p-5 rounded-2xl bg-[#232334]/50 border border-[#313244] hover:border-[#89b4fa]/40 transition-all duration-300 flex gap-4 group">
                    <div className="p-3 rounded-xl bg-[#89b4fa]/10 text-[#89b4fa] shrink-0 h-fit group-hover:scale-105 transition-transform duration-200">
                      <TerminalBigIcon />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <h4 className="text-sm font-bold text-[#cdd6f4]">SSH Terminal</h4>
                      <p className="text-xs text-[#a6adc8] leading-relaxed">
                        Sesi terminal interaktif yang lengkap dengan dukungan xterm.js, kustomisasi penuh, dan pengelolaan snippet perintah cepat.
                      </p>
                    </div>
                  </div>

                  {/* Card 2: SFTP */}
                  <div className="p-5 rounded-2xl bg-[#232334]/50 border border-[#313244] hover:border-[#a6e3a1]/40 transition-all duration-300 flex gap-4 group">
                    <div className="p-3 rounded-xl bg-[#a6e3a1]/10 text-[#a6e3a1] shrink-0 h-fit group-hover:scale-105 transition-transform duration-200">
                      <SftpBigIcon />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <h4 className="text-sm font-bold text-[#cdd6f4]">SFTP File Manager</h4>
                      <p className="text-xs text-[#a6adc8] leading-relaxed">
                        Manajer berkas dua panel untuk unggah/unduh secara drag & drop, modul navigasi lokal-remote, dan pengaturan hak akses berkas (Chmod).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Primary Actions */}
                <div className="flex flex-wrap gap-4 justify-center" style={{ margin: '32px 0 24px 0' }}>
                  <button
                    onClick={() => { setEditingHost(null); setShowAddHost(true) }}
                    className="interactive-hover flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0"
                    style={{ background: 'var(--accent)', color: 'var(--bg-primary)', boxShadow: '0 4px 14px rgba(137, 180, 250, 0.25)' }}
                  >
                    <PlusIcon /> Add New Host
                  </button>
                  {hosts.length > 0 && (
                    <button
                      onClick={() => handleConnect(hosts[0], 'terminal')}
                      className="interactive-hover flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0"
                      style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                    >
                      <ServerIcon /> Quick Connect ({hosts[0].name})
                    </button>
                  )}
                </div>

                {/* Shortcuts Grid - Clean & Responsive */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs w-full max-w-xl mx-auto pt-4 text-[#a6adc8]">
                  <div className="flex items-center gap-2 bg-[#232334]/30 px-3.5 py-2.5 rounded-xl border border-[#313244] justify-center">
                    <kbd className="px-2 py-1 rounded bg-[#141421] border border-[#313244] font-mono text-[9px] font-bold text-[#cdd6f4]">Ctrl+N</kbd>
                    <span className="font-semibold text-[11px]">New Host</span>
                  </div>
                  <div className="flex items-center gap-2 bg-[#232334]/30 px-3.5 py-2.5 rounded-xl border border-[#313244] justify-center">
                    <kbd className="px-2 py-1 rounded bg-[#141421] border border-[#313244] font-mono text-[9px] font-bold text-[#cdd6f4]">Ctrl+T</kbd>
                    <span className="font-semibold text-[11px]">New Tab</span>
                  </div>
                  <div className="flex items-center gap-2 bg-[#232334]/30 px-3.5 py-2.5 rounded-xl border border-[#313244] justify-center">
                    <kbd className="px-2 py-1 rounded bg-[#141421] border border-[#313244] font-mono text-[9px] font-bold text-[#cdd6f4]">Ctrl+W</kbd>
                    <span className="font-semibold text-[11px]">Close Tab</span>
                  </div>
                  <div className="flex items-center gap-2 bg-[#232334]/30 px-3.5 py-2.5 rounded-xl border border-[#313244] justify-center">
                    <kbd className="px-2 py-1 rounded bg-[#141421] border border-[#313244] font-mono text-[9px] font-bold text-[#cdd6f4]">Ctrl+B</kbd>
                    <span className="font-semibold text-[11px]">Sidebar</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Terminal views — always rendered but hidden when SFTP mode */}
              {tabs.map(tab => (
                <div
                  key={tab.id}
                  className={`absolute inset-0 ${tab.id === activeTab && viewMode === 'terminal' ? '' : 'hidden'}`}
                >
                  <TerminalTab
                    sessionId={tab.sessionId}
                    isActive={tab.id === activeTab && viewMode === 'terminal'}
                  />
                </div>
              ))}

              {/* SFTP view — only for the active tab */}
              {activeTab && viewMode === 'sftp' && (
                <div className="absolute inset-0 animate-fade-in">
                  <SftpManager
                    sessionId={tabs.find(t => t.id === activeTab)?.sessionId || ''}
                    isActive={viewMode === 'sftp'}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Status Bar */}
        {tabs.length > 0 && (
          <div
            className="h-7 flex items-center px-5 gap-5 text-[11px] select-none"
            style={{
              background: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              fontWeight: 500,
              letterSpacing: '0.03em'
            }}
          >
            <div className="flex items-center gap-2">
              <WifiIcon />
              <span>{connectedCount} connected</span>
            </div>
            <div className="flex-1" />

            {/* Snippet Drawer toggle */}
            {viewMode === 'terminal' && (
              <button
                onClick={() => setShowSnippetDrawer(prev => !prev)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all duration-150"
                style={{
                  color: showSnippetDrawer ? 'var(--accent)' : 'var(--text-muted)',
                  background: showSnippetDrawer ? 'var(--accent-glow)' : 'transparent'
                }}
                onMouseEnter={e => { if (!showSnippetDrawer) e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { if (!showSnippetDrawer) e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                <CodeIcon />
                <span className="text-[10px] font-semibold">Snippets</span>
              </button>
            )}

            <span style={{ opacity: 0.5 }}>Develop By Rteitch v1</span>
            {activeTabData && (
              <>
                <span style={{ color: 'var(--text-secondary)' }}>{activeTabData.hostName}</span>
                <span style={{ color: activeTabData.connected ? 'var(--success)' : 'var(--error)' }}>
                  {activeTabData.connected ? 'Online' : 'Connecting...'}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Snippet Drawer Overlay */}
      {showSnippetDrawer && viewMode === 'terminal' && (
        <div
          className="w-[320px] flex flex-col h-full shrink-0 animate-slide-in-right"
          style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}
        >
          {/* Drawer Header */}
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-2.5">
              <span style={{ color: 'var(--accent)' }}><CodeIcon /></span>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Snippets</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                {snippets.length}
              </span>
            </div>
            <button
              onClick={() => setShowSnippetDrawer(false)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <CloseIcon />
            </button>
          </div>

          {/* Add Snippet Form */}
          <form onSubmit={handleAddSnippet} className="px-5 py-4 space-y-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <input
              type="text"
              value={newSnippetName}
              onChange={e => setNewSnippetName(e.target.value)}
              placeholder="Snippet name..."
              className="w-full bg-[#1e1e2e] border border-[#313244] rounded-xl px-3.5 py-2.5 text-xs text-[#cdd6f4] outline-none focus:border-[#89b4fa]"
            />
            <input
              type="text"
              value={newSnippetCmd}
              onChange={e => setNewSnippetCmd(e.target.value)}
              placeholder="Command..."
              className="w-full bg-[#1e1e2e] border border-[#313244] rounded-xl px-3.5 py-2.5 text-xs text-[#cdd6f4] outline-none focus:border-[#89b4fa] font-mono"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={newSnippetTag}
                onChange={e => setNewSnippetTag(e.target.value)}
                placeholder="Tag (optional)"
                className="flex-1 bg-[#1e1e2e] border border-[#313244] rounded-xl px-3.5 py-2.5 text-xs text-[#cdd6f4] outline-none focus:border-[#89b4fa]"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl text-xs font-semibold transition-all"
                style={{ background: 'var(--accent)', color: 'var(--bg-primary)' }}
              >
                <PlusIcon />
              </button>
            </div>
          </form>

          {/* Snippet List */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
            {snippets.length === 0 ? (
              <div className="text-center py-10 text-xs" style={{ color: 'var(--text-muted)' }}>
                No snippets yet. Add your first one above!
              </div>
            ) : (
              snippets.map(snippet => (
                <div
                  key={snippet.id}
                  className="group px-4 py-3 rounded-xl transition-all duration-150 border border-transparent hover:border-[#313244]"
                  style={{ background: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {snippet.name}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleRunSnippet(snippet.command)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--success)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(166, 227, 161, 0.15)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        title="Run in terminal"
                      >
                        <PlayIcon />
                      </button>
                      <button
                        onClick={() => handleDeleteSnippet(snippet.id)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--error)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(243, 139, 168, 0.15)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        title="Delete snippet"
                      >
                        <TrashSmallIcon />
                      </button>
                    </div>
                  </div>
                  <code className="block text-[11px] font-mono truncate" style={{ color: 'var(--accent)' }}>
                    $ {snippet.command}
                  </code>
                  {snippet.tag && (
                    <span className="inline-block mt-1.5 text-[9px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}>
                      {snippet.tag}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showAddHost && (
        <AddHostModal
          host={editingHost}
          onSave={handleSaveHost}
          onClose={() => { setShowAddHost(false); setEditingHost(null) }}
        />
      )}
    </div>
  )
}

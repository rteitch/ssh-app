import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import TerminalTab from './components/Terminal/TerminalTab'
import TabBar from './components/Terminal/TabBar'
import AddHostModal from './components/Modals/AddHostModal'
import type { Host } from './types'

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
      getSnippets: () => Promise<any[]>
      createSnippet: (snippet: any) => Promise<any>
      updateSnippet: (id: string, snippet: any) => Promise<any>
      deleteSnippet: (id: string) => Promise<boolean>
      showOpenDialog: (options: any) => Promise<any>
      showSaveDialog: (options: any) => Promise<any>
      onTransferProgress: (callback: (progress: any) => void) => () => void
    }
  }
}

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

export default function App() {
  const [hosts, setHosts] = useState<Host[]>([])
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [showAddHost, setShowAddHost] = useState(false)
  const [editingHost, setEditingHost] = useState<Host | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const loadHosts = useCallback(async () => {
    const list = await window.sshApi.getHosts()
    setHosts(list)
  }, [])

  useEffect(() => {
    loadHosts()
  }, [loadHosts])

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
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleConnect = async (host: Host) => {
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
          onSelectTab={setActiveTab}
          onCloseTab={handleCloseTab}
        />

        <div className="flex-1 relative overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
          {tabs.length === 0 ? (
            /* Welcome Screen - properly centered */
            <div className="welcome-container">
              <div className="welcome-content animate-fade-in">
                <div className="mb-10 flex justify-center">
                  <div className="p-6 rounded-2xl" style={{ background: 'var(--accent-glow)', border: '1px solid var(--border)' }}>
                    <TerminalBigIcon />
                  </div>
                </div>
                <h2 className="text-3xl font-bold mb-4 gradient-text">Welcome to SSH App</h2>
                <p className="text-sm mb-3 font-medium" style={{ color: 'var(--accent)' }}>
                  Develop By Rteitch &middot; v1
                </p>
                <p className="text-base mb-12 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  A modern SSH terminal and file manager.<br />Connect to your servers with ease.
                </p>

                <div className="flex gap-4 justify-center mb-12">
                  <button
                    onClick={() => { setEditingHost(null); setShowAddHost(true) }}
                    className="interactive-hover flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-sm font-semibold"
                    style={{ background: 'var(--accent)', color: 'var(--bg-primary)', boxShadow: '0 4px 14px rgba(137, 180, 250, 0.3)' }}
                  >
                    <PlusIcon /> Add New Host
                  </button>
                  {hosts.length > 0 && (
                    <button
                      onClick={() => handleConnect(hosts[0])}
                      className="interactive-hover flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-sm font-semibold"
                      style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                    >
                      <ServerIcon /> Quick Connect
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-6 justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
                  <div className="flex items-center gap-2">
                    <kbd className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-semibold" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>Ctrl+N</kbd>
                    <span className="font-medium">New Host</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-semibold" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>Ctrl+T</kbd>
                    <span className="font-medium">New Tab</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-semibold" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>Ctrl+W</kbd>
                    <span className="font-medium">Close Tab</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-semibold" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>Ctrl+B</kbd>
                    <span className="font-medium">Toggle Sidebar</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            tabs.map(tab => (
              <div
                key={tab.id}
                className={`absolute inset-0 ${tab.id === activeTab ? '' : 'hidden'}`}
              >
                <TerminalTab
                  sessionId={tab.sessionId}
                  isActive={tab.id === activeTab}
                />
              </div>
            ))
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

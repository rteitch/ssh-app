interface Tab {
  id: string
  hostId: string
  hostName: string
  sessionId: string
  connected: boolean
}

type ViewMode = 'terminal' | 'sftp'

interface TabBarProps {
  tabs: Tab[]
  activeTab: string | null
  viewMode: ViewMode
  onSelectTab: (id: string) => void
  onCloseTab: (id: string) => void
  onViewModeChange: (mode: ViewMode) => void
}

const CloseIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const TerminalSmallIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
  </svg>
)

const FolderSmallIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
)

export default function TabBar({ tabs, activeTab, viewMode, onSelectTab, onCloseTab, onViewModeChange }: TabBarProps) {
  if (tabs.length === 0) return null

  return (
    <div
      className="flex items-stretch overflow-hidden select-none shrink-0"
      style={{
        height: '44px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 4px'
      }}
    >
      {/* Tabs */}
      <div className="flex items-end flex-1 min-w-0 overflow-x-auto gap-0.5">
        {tabs.map(tab => {
          const isActive = tab.id === activeTab
          return (
            <div
              key={tab.id}
              className="relative flex items-center gap-2 cursor-pointer shrink-0 group"
              style={{
                minWidth: '130px',
                maxWidth: '200px',
                height: '44px',
                padding: '0 10px 0 12px',
                background: isActive ? 'var(--bg-primary)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                borderTop: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                borderBottom: isActive ? '2px solid var(--bg-primary)' : '2px solid transparent',
                marginBottom: isActive ? '-1px' : '0',
                transition: 'all 0.12s ease'
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-surface)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              onClick={() => onSelectTab(tab.id)}
            >
              <span style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)', opacity: isActive ? 1 : 0.5, flexShrink: 0 }}>
                <TerminalSmallIcon />
              </span>

              <span className="flex-1 truncate" style={{ fontSize: '12px', fontWeight: isActive ? 600 : 500 }}>
                {tab.hostName}
              </span>

              {/* Connection status dot */}
              <span
                className={`flex-shrink-0 ${tab.connected ? 'animate-pulse-dot' : ''}`}
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '999px',
                  background: tab.connected ? 'var(--success)' : 'var(--error)',
                  flexShrink: 0
                }}
              />

              {/* Close button */}
              <button
                onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id) }}
                className="opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-150"
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '4px',
                  color: 'var(--text-muted)',
                  flexShrink: 0
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--error)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                <CloseIcon />
              </button>
            </div>
          )
        })}
      </div>

      {/* View Mode Switcher */}
      {activeTab && (
        <div
          className="view-mode-switcher"
          title="Switch View (Ctrl+Shift+S)"
        >
          <button
            onClick={() => onViewModeChange('terminal')}
            className={`view-mode-btn ${viewMode === 'terminal' ? 'active-terminal' : ''}`}
          >
            <TerminalSmallIcon /> Terminal
          </button>
          <button
            onClick={() => onViewModeChange('sftp')}
            className={`view-mode-btn ${viewMode === 'sftp' ? 'active-sftp' : ''}`}
          >
            <FolderSmallIcon /> SFTP
          </button>
        </div>
      )}
    </div>
  )
}
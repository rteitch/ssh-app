interface Tab {
  id: string
  hostId: string
  hostName: string
  sessionId: string
  connected: boolean
}

interface TabBarProps {
  tabs: Tab[]
  activeTab: string | null
  onSelectTab: (id: string) => void
  onCloseTab: (id: string) => void
}

const CloseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const TerminalSmallIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
  </svg>
)

export default function TabBar({ tabs, activeTab, onSelectTab, onCloseTab }: TabBarProps) {
  if (tabs.length === 0) return null

  return (
    <div
      className="flex items-end h-10 px-1 gap-0.5 overflow-x-auto"
      style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}
    >
      {tabs.map(tab => {
        const isActive = tab.id === activeTab
        return (
          <div
            key={tab.id}
            className="relative flex items-center gap-2 pl-3 pr-2 py-1.5 cursor-pointer rounded-t-lg transition-all duration-200 group"
            style={{
              minWidth: '130px',
              maxWidth: '200px',
              background: isActive ? 'var(--bg-primary)' : 'transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              borderTop: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              marginTop: isActive ? '0' : '4px'
            }}
            onMouseEnter={e => {
              if (!isActive) e.currentTarget.style.background = 'var(--bg-surface)'
            }}
            onMouseLeave={e => {
              if (!isActive) e.currentTarget.style.background = 'transparent'
            }}
            onClick={() => onSelectTab(tab.id)}
          >
            <span style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)', opacity: isActive ? 1 : 0.6 }}>
              <TerminalSmallIcon />
            </span>
            <span className="flex-1 text-sm truncate font-medium">{tab.hostName}</span>

            {/* Connection indicator */}
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${tab.connected ? 'animate-pulse-dot' : ''}`}
              style={{ background: tab.connected ? 'var(--success)' : 'var(--error)' }}
            />

            {/* Close button */}
            <button
              onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id) }}
              className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded transition-all duration-150"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--error)'
                e.currentTarget.style.color = 'var(--bg-primary)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-muted)'
              }}
            >
              <CloseIcon />
            </button>
          </div>
        )
      })}
    </div>
  )
}

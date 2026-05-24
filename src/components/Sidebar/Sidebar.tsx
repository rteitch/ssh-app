import { useState, useMemo } from 'react'
import type { Host } from '../../types'

interface SidebarProps {
  hosts: Host[]
  collapsed: boolean
  onToggleCollapse: () => void
  onConnect: (host: Host) => void
  onAddHost: () => void
  onEditHost: (host: Host) => void
  onDeleteHost: (id: string) => void
}

const ServerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
  </svg>
)

const FolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
)

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

const TerminalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
  </svg>
)

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
)

const ConnectIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
  </svg>
)

const ChevronLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6"/>
  </svg>
)

const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6"/>
  </svg>
)

export default function Sidebar({ hosts, collapsed, onToggleCollapse, onConnect, onAddHost, onEditHost, onDeleteHost }: SidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Default']))
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; host: Host } | null>(null)
  const [search, setSearch] = useState('')

  const groups = useMemo(() => {
    const filtered = search
      ? hosts.filter(h =>
          h.name.toLowerCase().includes(search.toLowerCase()) ||
          h.host.toLowerCase().includes(search.toLowerCase()) ||
          h.username.toLowerCase().includes(search.toLowerCase())
        )
      : hosts

    return filtered.reduce<Record<string, Host[]>>((acc, host) => {
      const group = host.group_name || 'Default'
      if (!acc[group]) acc[group] = []
      acc[group].push(host)
      return acc
    }, {})
  }, [hosts, search])

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  const handleContextMenu = (e: React.MouseEvent, host: Host) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, host })
  }

  const closeContextMenu = () => setContextMenu(null)

  if (collapsed) {
    return (
      <div
        className="w-16 flex flex-col items-center h-full select-none py-3 gap-2"
        style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
      >
        {/* macOS Traffic Lights spacer */}
        <div className="h-12 w-full shrink-0" style={{ WebkitAppRegion: 'drag' } as any} />
        <button
          onClick={onToggleCollapse}
          className="p-2.5 rounded-xl transition-all duration-200 mb-2"
          style={{ color: 'var(--accent)' }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--bg-surface)'
            e.currentTarget.style.transform = 'scale(1.05)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.transform = 'scale(1)'
          }}
          title="Expand sidebar (Ctrl+B)"
        >
          <TerminalIcon />
        </button>
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg transition-colors duration-150"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--bg-surface)'
            e.currentTarget.style.color = 'var(--text-primary)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-muted)'
          }}
          title="Expand sidebar (Ctrl+B)"
        >
          <ChevronRightIcon />
        </button>
        <div className="w-8 my-3" style={{ borderTop: '1px solid var(--border-subtle)' }} />
        <button
          onClick={onAddHost}
          className="p-2.5 rounded-xl transition-all duration-200"
          style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--accent)'
            e.currentTarget.style.color = 'var(--bg-primary)'
            e.currentTarget.style.borderColor = 'var(--accent)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--bg-surface)'
            e.currentTarget.style.color = 'var(--text-primary)'
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
          title="Add Host"
        >
          <PlusIcon />
        </button>
        <div className="flex-1 overflow-y-auto w-full flex flex-col items-center gap-3 mt-4 px-2">
          {hosts.map(host => (
            <button
              key={host.id}
              onClick={() => onConnect(host)}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid transparent' }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--accent-glow)'
                e.currentTarget.style.color = 'var(--accent)'
                e.currentTarget.style.borderColor = 'rgba(137, 180, 250, 0.3)'
                e.currentTarget.style.transform = 'scale(1.1)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--bg-surface)'
                e.currentTarget.style.color = 'var(--text-muted)'
                e.currentTarget.style.borderColor = 'transparent'
                e.currentTarget.style.transform = 'scale(1)'
              }}
              title={`${host.name}\n${host.username}@${host.host}:${host.port}`}
            >
              <ServerIcon />
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className="w-[300px] flex flex-col h-full select-none"
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
      onClick={closeContextMenu}
    >
      {/* macOS Traffic Lights spacer */}
      <div className="h-12 w-full shrink-0" style={{ WebkitAppRegion: 'drag' } as any} />

      {/* App Header */}
      <div className="px-6 pb-5 pt-2 flex items-center gap-3">
        <div className="p-2 rounded-xl" style={{ background: 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid rgba(137, 180, 250, 0.2)' }}>
          <TerminalIcon />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>SSH App</h1>
          <p className="text-[10px] font-medium uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-muted)' }}>v1 &middot; By Rteitch</p>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg transition-colors duration-150"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--bg-surface)'
            e.currentTarget.style.color = 'var(--text-primary)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-muted)'
          }}
          title="Collapse sidebar (Ctrl+B)"
        >
          <ChevronLeftIcon />
        </button>
      </div>

      {/* Search */}
      <div className="px-5 pb-5">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors" style={{ color: 'var(--text-muted)' }}>
            <SearchIcon />
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search hosts..."
            className="form-input-wrapper w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)'
            }}
          />
        </div>
      </div>

      {/* Hosts Header */}
      <div className="px-6 py-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Hosts
        </span>
        <button
          onClick={onAddHost}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200"
          style={{ background: 'var(--accent)', color: 'var(--bg-primary)' }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <PlusIcon /> Add
        </button>
      </div>

      {/* Host List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {Object.entries(groups).map(([group, groupHosts]) => (
          <div key={group} className="mb-2">
            <button
              onClick={() => toggleGroup(group)}
              className="w-full px-3 py-2 flex items-center gap-2.5 text-xs font-semibold rounded-xl transition-colors duration-150"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ color: 'var(--text-muted)' }}>
                <FolderIcon />
              </span>
              <span className="flex-1 text-left">{group}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                {groupHosts.length}
              </span>
            </button>

            {expandedGroups.has(group) && (
              <div className="mt-1 space-y-0.5">
                {groupHosts.map(host => (
                  <div
                    key={host.id}
                    className="flex items-center gap-3 px-3 py-2.5 mx-1 rounded-xl cursor-pointer transition-all duration-200 group"
                    style={{ border: '1px solid transparent' }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'var(--bg-surface)'
                      e.currentTarget.style.borderColor = 'var(--border)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.borderColor = 'transparent'
                    }}
                    onDoubleClick={() => onConnect(host)}
                    onContextMenu={(e) => handleContextMenu(e, host)}
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                      <ServerIcon />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate transition-colors" style={{ color: 'var(--text-primary)' }}>{host.name}</div>
                      <div className="text-[11px] font-medium truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {host.username}@{host.host}:{host.port}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onConnect(host) }}
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all duration-200"
                      style={{ background: 'var(--success)', color: 'var(--bg-primary)' }}
                    >
                      <ConnectIcon />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {hosts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              <ServerIcon />
            </div>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>No hosts yet</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>Click "+ Add" to configure your first server</p>
          </div>
        )}

        {hosts.length > 0 && Object.keys(groups).length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No hosts match "{search}"</p>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed rounded-xl shadow-2xl py-2 z-50 animate-fade-in overflow-hidden"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            minWidth: '180px',
            backdropFilter: 'blur(12px)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-4 py-2.5 text-sm font-medium text-left flex items-center gap-3 transition-colors duration-100"
            style={{ color: 'var(--success)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-primary)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => { onConnect(contextMenu.host); closeContextMenu() }}
          >
            <ConnectIcon /> Connect
          </button>
          <button
            className="w-full px-4 py-2.5 text-sm font-medium text-left flex items-center gap-3 transition-colors duration-100"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--bg-primary)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
            onClick={() => { onEditHost(contextMenu.host); closeContextMenu() }}
          >
            <EditIcon /> Edit
          </button>
          <div className="mx-3 my-1.5" style={{ borderTop: '1px solid var(--border-subtle)' }} />
          <button
            className="w-full px-4 py-2.5 text-sm font-medium text-left flex items-center gap-3 transition-colors duration-100"
            style={{ color: 'var(--error)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(243, 139, 168, 0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => { onDeleteHost(contextMenu.host.id); closeContextMenu() }}
          >
            <TrashIcon /> Delete
          </button>
        </div>
      )}
    </div>
  )
}

import { useState, useMemo } from 'react'
import type { Host } from '../../types'

interface SidebarProps {
  hosts: Host[]
  collapsed: boolean
  onToggleCollapse: () => void
  onConnect: (host: Host, defaultViewMode?: 'terminal' | 'sftp') => void
  onAddHost: () => void
  onEditHost: (host: Host) => void
  onDeleteHost: (id: string) => void
}

/* ── Icons ── */
const ServerIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
    <line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
  </svg>
)

const FolderOpenIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
)

const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

const SearchIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

const TerminalIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
  </svg>
)

const SftpIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    <polyline points="12 10 12 16"/><polyline points="9 13 12 16 15 13"/>
  </svg>
)

const EditIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
)

const ChevronRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M9 18l6-6-6-6"/>
  </svg>
)

const ChevronLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M15 18l-6-6 6-6"/>
  </svg>
)

const ChevronDownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="6 9 12 15 18 9"/>
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

  /* ── Collapsed sidebar ── */
  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center h-full select-none py-2 gap-1"
        style={{
          width: '56px',
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-subtle)',
          flexShrink: 0
        }}
      >
        <div className="h-12 w-full shrink-0" style={{ WebkitAppRegion: 'drag' } as any} />

        {/* Logo button */}
        <button
          onClick={onToggleCollapse}
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150"
          style={{ color: 'var(--accent)', background: 'var(--accent-glow)' }}
          title="Expand sidebar (Ctrl+B)"
        >
          <TerminalIcon size={16} />
        </button>

        <button
          onClick={onToggleCollapse}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-surface)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
          title="Expand (Ctrl+B)"
        >
          <ChevronRightIcon />
        </button>

        <div style={{ width: '28px', height: '1px', background: 'var(--border-subtle)', margin: '6px 0' }} />

        {/* Add host */}
        <button
          onClick={onAddHost}
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#0a0a0c'; e.currentTarget.style.borderColor = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)' }}
          title="Add host (Ctrl+N)"
        >
          <PlusIcon />
        </button>

        <div style={{ width: '28px', height: '1px', background: 'var(--border-subtle)', margin: '6px 0' }} />

        {/* Host dots */}
        {hosts.slice(0, 8).map(host => (
          <button
            key={host.id}
            onClick={() => onConnect(host, 'terminal')}
            className="w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-glow)'; e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)' }}
            title={host.name}
          >
            <ServerIcon size={14} />
          </button>
        ))}
      </div>
    )
  }

  /* ── Expanded sidebar ── */
  return (
    <div
      className="flex flex-col h-full select-none"
      style={{
        width: '260px',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}
      onClick={closeContextMenu}
    >
      {/* Traffic lights spacer + brand header */}
      <div
        className="flex items-center justify-between px-4 shrink-0"
        style={{
          height: '52px',
          borderBottom: '1px solid var(--border-subtle)',
          WebkitAppRegion: 'drag'
        } as any}
      >
        <div className="flex items-center gap-2.5" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <div
            className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ background: 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid rgba(92,158,255,0.18)' }}
          >
            <TerminalIcon size={14} />
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            SSH Manager
          </span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="w-6 h-6 flex items-center justify-center rounded-md transition-all duration-150"
          style={{ color: 'var(--text-muted)', WebkitAppRegion: 'no-drag' } as any}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          title="Collapse (Ctrl+B)"
        >
          <ChevronLeftIcon />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div
          className="flex items-center gap-2 px-3"
          style={{
            height: '32px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            transition: 'border-color 0.12s, box-shadow 0.12s'
          }}
          onFocusCapture={e => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = 'var(--accent)'
            el.style.boxShadow = '0 0 0 2px var(--accent-glow)'
          }}
          onBlurCapture={e => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = 'var(--border)'
            el.style.boxShadow = 'none'
          }}
        >
          <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}><SearchIcon /></span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search hosts..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '12px',
              color: 'var(--text-primary)'
            }}
          />
        </div>
      </div>

      {/* Hosts section label + add button */}
      <div className="flex items-center justify-between px-4 py-2">
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          Hosts
        </span>
        <button
          onClick={onAddHost}
          className="flex items-center gap-1.5 transition-all duration-150"
          style={{
            padding: '4px 10px',
            background: 'var(--accent)',
            color: '#0a0a0c',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            fontWeight: 700,
            boxShadow: '0 2px 8px rgba(92,158,255,0.25)'
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(92,158,255,0.35)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(92,158,255,0.25)' }}
        >
          <PlusIcon /> Add
        </button>
      </div>

      {/* Host List */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {Object.entries(groups).map(([group, groupHosts]) => (
          <div key={group} className="mb-1">
            <button
              onClick={() => toggleGroup(group)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-100"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span
                className="transition-transform duration-150"
                style={{
                  transform: expandedGroups.has(group) ? 'rotate(90deg)' : 'rotate(0deg)',
                  color: 'var(--text-muted)'
                }}
              >
                <ChevronRightIcon />
              </span>
              <span style={{ color: '#e0af68', flexShrink: 0 }}><FolderOpenIcon /></span>
              <span className="flex-1 text-left" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {group}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-muted)'
                }}
              >
                {groupHosts.length}
              </span>
            </button>

            {expandedGroups.has(group) && (
              <div className="mt-0.5 space-y-0.5">
                {groupHosts.map(host => (
                  <div
                    key={host.id}
                    className="host-item group"
                    onDoubleClick={() => onConnect(host, 'terminal')}
                    onContextMenu={(e) => handleContextMenu(e, host)}
                  >
                    <div className="host-icon">
                      <ServerIcon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">
                        {host.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} className="truncate mt-0.5">
                        {host.username}@{host.host}
                      </div>
                    </div>

                    <div className="host-quick-actions">
                      <button
                        onClick={(e) => { e.stopPropagation(); onConnect(host, 'terminal') }}
                        className="quick-action-btn"
                        style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#0a0a0c' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-glow)'; e.currentTarget.style.color = 'var(--accent)' }}
                        title="Connect Terminal"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onConnect(host, 'sftp') }}
                        className="quick-action-btn"
                        style={{ background: 'var(--success-glow)', color: 'var(--success)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--success)'; e.currentTarget.style.color = '#0a0a0c' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--success-glow)'; e.currentTarget.style.color = 'var(--success)' }}
                        title="SFTP Files"
                      >
                        <SftpIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {hosts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div
              className="w-10 h-10 flex items-center justify-center rounded-xl mb-3"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              <ServerIcon size={18} />
            </div>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>No hosts yet</p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click "+ Add" to configure<br/>your first server</p>
          </div>
        )}

        {hosts.length > 0 && Object.keys(groups).length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No hosts match "{search}"</p>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          <button
            className="context-menu-item accent"
            onClick={() => { onConnect(contextMenu.host, 'terminal'); closeContextMenu() }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
            Connect Terminal
          </button>
          <button
            className="context-menu-item success"
            onClick={() => { onConnect(contextMenu.host, 'sftp'); closeContextMenu() }}
          >
            <SftpIcon />
            Connect SFTP
          </button>
          <div className="context-menu-separator" />
          <button
            className="context-menu-item"
            onClick={() => { onEditHost(contextMenu.host); closeContextMenu() }}
          >
            <EditIcon /> Edit Host
          </button>
          <div className="context-menu-separator" />
          <button
            className="context-menu-item danger"
            onClick={() => { onDeleteHost(contextMenu.host.id); closeContextMenu() }}
          >
            <TrashIcon /> Delete Host
          </button>
        </div>
      )}
    </div>
  )
}
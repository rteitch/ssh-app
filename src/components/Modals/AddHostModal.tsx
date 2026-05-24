import { useState, useEffect } from 'react'
import type { Host } from '../../types'

interface AddHostModalProps {
  host: Host | null
  onSave: (host: any) => void
  onClose: () => void
}

const ServerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
  </svg>
)

const GlobeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
)

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)

const KeyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
  </svg>
)

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

const FolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
)

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

interface InputFieldProps {
  label: string
  icon: React.ReactNode
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  required?: boolean
}

function InputField({ label, icon, value, onChange, placeholder, type = 'text', required }: InputFieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <div
        className="form-input-wrapper flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
      >
        <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          className="bg-transparent flex-1 text-sm outline-none"
          style={{ color: 'var(--text-primary)' }}
        />
      </div>
    </div>
  )
}

export default function AddHostModal({ host, onSave, onClose }: AddHostModalProps) {
  const [name, setName] = useState('')
  const [groupName, setGroupName] = useState('Default')
  const [hostname, setHostname] = useState('')
  const [port, setPort] = useState('22')
  const [username, setUsername] = useState('')
  const [authType, setAuthType] = useState<'password' | 'key' | 'key_passphrase'>('password')
  const [password, setPassword] = useState('')
  const [keyPath, setKeyPath] = useState('')
  const [passphrase, setPassphrase] = useState('')

  useEffect(() => {
    if (host) {
      setName(host.name)
      setGroupName(host.group_name)
      setHostname(host.host)
      setPort(String(host.port))
      setUsername(host.username)
      setAuthType(host.auth_type)
      setKeyPath(host.key_path || '')
    }
  }, [host])

  const handleBrowseKey = async () => {
    const result = await window.sshApi.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'SSH Keys', extensions: ['pem', 'key', 'pub', ''] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (!result.canceled && result.filePaths.length > 0) {
      setKeyPath(result.filePaths[0])
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const hostData: any = {
      name,
      group_name: groupName,
      host: hostname,
      port: parseInt(port) || 22,
      username,
      auth_type: authType
    }

    if (authType === 'password') {
      hostData.password_enc = password
    } else if (authType === 'key') {
      hostData.key_path = keyPath
    } else if (authType === 'key_passphrase') {
      hostData.key_path = keyPath
      hostData.passphrase_enc = passphrase
    }

    onSave(hostData)
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-[520px] mx-6 max-h-[90vh] overflow-y-auto animate-slide-in"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}>
              <ServerIcon />
            </div>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {host ? 'Edit Host' : 'Add New Host'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl transition-colors duration-150"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-primary)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-6">
          {/* Connection Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 mb-1">
              <span style={{ color: 'var(--accent)' }}><GlobeIcon /></span>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Connection</span>
            </div>

            <InputField label="Host Name" icon={<ServerIcon />} value={name} onChange={setName} placeholder="My Server" required />
            <InputField label="Group" icon={<FolderIcon />} value={groupName} onChange={setGroupName} placeholder="Default" />

            <div className="flex gap-4">
              <div className="flex-1 min-w-0">
                <InputField label="Hostname / IP" icon={<GlobeIcon />} value={hostname} onChange={setHostname} placeholder="192.168.1.100" required />
              </div>
              <div className="w-28 flex-shrink-0">
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Port</label>
                <div
                  className="form-input-wrapper flex items-center gap-2 px-4 py-3 rounded-xl"
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                >
                  <input
                    type="text"
                    value={port}
                    onChange={e => setPort(e.target.value)}
                    className="bg-transparent flex-1 text-sm outline-none text-center"
                    style={{ color: 'var(--text-primary)' }}
                    placeholder="22"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Authentication Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 mb-1">
              <span style={{ color: 'var(--accent)' }}><LockIcon /></span>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Authentication</span>
            </div>

            <InputField label="Username" icon={<UserIcon />} value={username} onChange={setUsername} placeholder="root" required />

            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Auth Method</label>
              <div className="flex flex-wrap gap-3">
                {[
                  { value: 'password', label: 'Password', icon: <LockIcon /> },
                  { value: 'key', label: 'SSH Key', icon: <KeyIcon /> },
                  { value: 'key_passphrase', label: 'Key + Passphrase', icon: <KeyIcon /> }
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAuthType(opt.value as any)}
                    className="flex-1 min-w-[110px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200"
                    style={{
                      background: authType === opt.value ? 'var(--accent-glow)' : 'var(--bg-primary)',
                      border: authType === opt.value ? '1px solid var(--accent)' : '1px solid var(--border)',
                      color: authType === opt.value ? 'var(--accent)' : 'var(--text-muted)'
                    }}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {authType === 'password' && (
              <InputField label="Password" icon={<LockIcon />} value={password} onChange={setPassword} type="password" placeholder="Enter password" />
            )}

            {(authType === 'key' || authType === 'key_passphrase') && (
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>SSH Key Path</label>
                <div className="flex gap-3">
                  <div
                    className="form-input-wrapper flex-1 flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                  >
                    <span style={{ color: 'var(--text-muted)' }}><KeyIcon /></span>
                    <input
                      type="text"
                      value={keyPath}
                      onChange={e => setKeyPath(e.target.value)}
                      required
                      className="bg-transparent flex-1 text-sm outline-none"
                      style={{ color: 'var(--text-primary)' }}
                      placeholder="/Users/you/.ssh/id_rsa"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleBrowseKey}
                    className="px-5 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex-shrink-0"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    Browse
                  </button>
                </div>
              </div>
            )}

            {authType === 'key_passphrase' && (
              <InputField label="Passphrase" icon={<LockIcon />} value={passphrase} onChange={setPassphrase} type="password" placeholder="Enter passphrase" />
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-sm font-medium rounded-xl transition-all duration-200"
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--text-muted)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="interactive-hover px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-200"
              style={{ background: 'var(--accent)', color: 'var(--bg-primary)' }}
            >
              {host ? 'Update Host' : 'Save Host'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

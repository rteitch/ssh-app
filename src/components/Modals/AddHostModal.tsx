import { useState, useEffect } from 'react'
import type { Host } from '../../types'

interface AddHostModalProps {
  host: Host | null
  onSave: (host: any) => void
  onClose: () => void
}

/* ── Icons ── */
const ServerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
    <line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
  </svg>
)
const GlobeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
)
const UserIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)
const KeyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
  </svg>
)
const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)
const FolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
)
const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

function InputField({ label, icon, value, onChange, placeholder, type = 'text', required, monospace }: {
  label: string, icon: React.ReactNode, value: string, onChange: (v: string) => void,
  placeholder?: string, type?: string, required?: boolean, monospace?: boolean
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', letterSpacing: '0.02em' }}>
        {label}
      </label>
      <div className="input-base">
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{icon}</span>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          style={{
            flex: 1,
            fontSize: '13px',
            color: 'var(--text-primary)',
            fontFamily: monospace ? 'var(--font-mono)' : 'var(--font-ui)',
            outline: 'none',
            background: 'transparent'
          }}
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields are not empty
    if (!name.trim()) {
      alert('Display Name cannot be empty')
      return
    }
    if (!hostname.trim()) {
      alert('Hostname / IP cannot be empty')
      return
    }
    if (!username.trim()) {
      alert('Username cannot be empty')
      return
    }

    const portNum = parseInt(port, 10)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      alert('Port must be a valid number between 1 and 65535')
      return
    }

    if (authType === 'key' || authType === 'key_passphrase') {
      if (!keyPath.trim()) {
        alert('Please select or specify a valid SSH key path')
        return
      }
      try {
        const exists = await window.sshApi.fsExistsLocal(keyPath.trim())
        if (!exists) {
          alert(`SSH key file not found at: ${keyPath}`)
          return
        }
      } catch (err) {
        // Fallback if local fs checks throw
      }
    }

    if (authType === 'password') {
      const isPasswordRequired = !host || host.auth_type !== 'password' || !host.password_enc
      if (isPasswordRequired && !password) {
        alert('Password cannot be empty')
        return
      }
    }

    if (authType === 'key_passphrase') {
      const isPassphraseRequired = !host || host.auth_type !== 'key_passphrase' || !host.passphrase_enc
      if (isPassphraseRequired && !passphrase) {
        alert('Passphrase cannot be empty')
        return
      }
    }

    const hostData: any = {
      name: name.trim(),
      group_name: groupName.trim() || 'Default',
      host: hostname.trim(),
      port: portNum,
      username: username.trim(),
      auth_type: authType
    }

    if (authType === 'password') {
      if (password) {
        hostData.password_enc = password
      }
      // Bersihkan key dan passphrase lama di database jika tipe auth berubah
      hostData.key_path = null
      hostData.passphrase_enc = null
    } else if (authType === 'key') {
      hostData.key_path = keyPath.trim()
      hostData.password_enc = null
      hostData.passphrase_enc = null
    } else if (authType === 'key_passphrase') {
      hostData.key_path = keyPath.trim()
      if (passphrase) {
        hostData.passphrase_enc = passphrase
      }
      hostData.password_enc = null
    }

    onSave(hostData)
  }

  const authOptions = [
    { value: 'password', label: 'Password', icon: <LockIcon /> },
    { value: 'key', label: 'SSH Key', icon: <KeyIcon /> },
    { value: 'key_passphrase', label: 'Key + Pass', icon: <KeyIcon /> }
  ]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: '500px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="modal-header-icon">
              <ServerIcon />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                {host ? 'Edit Host' : 'Add New Host'}
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {host ? 'Update connection settings' : 'Configure SSH connection'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150"
            style={{ color: 'var(--text-muted)', background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Connection section */}
          <div className="modal-section">
            <div className="modal-section-title">
              <GlobeIcon /> Connection
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <InputField label="Display Name" icon={<ServerIcon />} value={name} onChange={setName} placeholder="Production Server" required />
              <InputField label="Group" icon={<FolderIcon />} value={groupName} onChange={setGroupName} placeholder="Default" />

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <InputField label="Hostname / IP" icon={<GlobeIcon />} value={hostname} onChange={setHostname} placeholder="192.168.1.100" required monospace />
                </div>
                <div style={{ width: '96px', flexShrink: 0 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', letterSpacing: '0.02em' }}>
                    Port
                  </label>
                  <div className="input-base" style={{ justifyContent: 'center' }}>
                    <input
                      type="text"
                      value={port}
                      onChange={e => setPort(e.target.value)}
                      placeholder="22"
                      style={{
                        width: '100%',
                        textAlign: 'center',
                        fontSize: '13px',
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-mono)',
                        outline: 'none',
                        background: 'transparent'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Auth section */}
          <div className="modal-section">
            <div className="modal-section-title">
              <LockIcon /> Authentication
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <InputField label="Username" icon={<UserIcon />} value={username} onChange={setUsername} placeholder="root" required monospace />

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.02em' }}>
                  Auth Method
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {authOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAuthType(opt.value as any)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '11px',
                        fontWeight: 700,
                        transition: 'all 0.12s ease',
                        border: authType === opt.value ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: authType === opt.value ? 'var(--accent-glow)' : 'var(--bg-input)',
                        color: authType === opt.value ? 'var(--accent)' : 'var(--text-muted)',
                        boxShadow: authType === opt.value ? '0 0 0 1px var(--accent)' : 'none'
                      }}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {authType === 'password' && (
                <InputField label="Password" icon={<LockIcon />} value={password} onChange={setPassword} type="password" placeholder="••••••••" />
              )}

              {(authType === 'key' || authType === 'key_passphrase') && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', letterSpacing: '0.02em' }}>
                    SSH Key Path
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div className="input-base" style={{ flex: 1 }}>
                      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}><KeyIcon /></span>
                      <input
                        type="text"
                        value={keyPath}
                        onChange={e => setKeyPath(e.target.value)}
                        required
                        placeholder="~/.ssh/id_rsa"
                        style={{
                          flex: 1,
                          fontSize: '12px',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-primary)',
                          outline: 'none',
                          background: 'transparent'
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleBrowseKey}
                      style={{
                        padding: '0 14px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                        transition: 'all 0.12s ease',
                        flexShrink: 0
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                    >
                      Browse
                    </button>
                  </div>
                </div>
              )}

              {authType === 'key_passphrase' && (
                <InputField label="Passphrase" icon={<LockIcon />} value={passphrase} onChange={setPassphrase} type="password" placeholder="Key passphrase..." />
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                fontWeight: 600,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                transition: 'all 0.12s ease',
                minWidth: '90px'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                fontWeight: 700,
                background: 'var(--accent)',
                color: '#0a0a0c',
                transition: 'all 0.15s ease',
                minWidth: '110px',
                boxShadow: 'var(--shadow-accent)'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(92,158,255,0.35)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-accent)' }}
            >
              {host ? 'Update Host' : 'Save Host'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
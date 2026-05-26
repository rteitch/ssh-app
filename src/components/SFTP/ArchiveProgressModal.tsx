import React, { useEffect, useState, useRef } from 'react'

interface ProgressData {
  phase: 'compressing' | 'extracting' | 'done' | 'error' | 'warning';
  message: string;
  percent?: number;
  bytesProcessed?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
}

export const ArchiveProgressModal: React.FC<Props> = ({ isOpen, onClose, title }) => {
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    window.sshApi.onArchiveProgress((data) => {
      setProgress(data)
      if (data.message) {
        setLogs(prev => [...prev.slice(-100), data.message]) // Simpan maks 100 baris log terakhir
      }
    })

    return () => {
      window.sshApi.offArchiveProgress()
      setProgress(null)
      setLogs([])
    }
  }, [isOpen])

  // Scroll otomatis ke log terbawah saat log baru masuk
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  if (!isOpen) return null

  const isDone  = progress?.phase === 'done'
  const isError = progress?.phase === 'error'
  const percent = progress?.percent ?? 0
  const isIndeterminate = percent === -1

  // Format ukuran byte yang diproses secara dinamis
  const formatBytes = (bytes?: number) => {
    if (!bytes) return ''
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10, 10, 15, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'fade-in 0.2s ease-out'
      }}
    >
      <div
        style={{
          width: '90%',
          maxWidth: '520px',
          background: '#1e1e2e',
          border: '1px solid #313244',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          animation: 'scale-up 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#cdd6f4', margin: 0 }}>
            {title}
          </h3>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '999px',
              background: isError ? 'rgba(243, 139, 168, 0.15)' : isDone ? 'rgba(166, 227, 161, 0.15)' : 'rgba(137, 180, 250, 0.15)',
              color: isError ? '#f38ba8' : isDone ? '#a6e3a1' : '#89b4fa',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            {progress?.phase === 'compressing' ? 'Compressing' : progress?.phase === 'extracting' ? 'Extracting' : progress?.phase || 'Preparing'}
          </span>
        </div>

        {/* Progress Bar Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              height: '8px',
              width: '100%',
              background: '#313244',
              borderRadius: '999px',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            {isIndeterminate ? (
              <div
                style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #89b4fa, #b4befe)',
                  borderRadius: '999px',
                  width: '40%',
                  position: 'absolute',
                  animation: 'indeterminate-slide 1.5s infinite linear'
                }}
              />
            ) : (
              <div
                style={{
                  height: '100%',
                  background: isError ? '#f38ba8' : isDone ? '#a6e3a1' : 'linear-gradient(90deg, #89b4fa, #b4befe)',
                  borderRadius: '999px',
                  width: `${Math.max(0, Math.min(100, percent))}%`,
                  transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              />
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#a6adc8', fontFamily: 'var(--font-mono)' }}>
            <span>{progress?.bytesProcessed ? formatBytes(progress.bytesProcessed) : 'Streaming...'}</span>
            {!isIndeterminate && <span>{percent}%</span>}
          </div>
        </div>

        {/* Status Message */}
        <p
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: isError ? '#f38ba8' : isDone ? '#a6e3a1' : '#cdd6f4',
            margin: '4px 0',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {progress?.message || 'Menyiapkan berkas...'}
        </p>

        {/* Console Log Output */}
        <div
          style={{
            height: '150px',
            background: '#11111b',
            border: '1px solid #313244',
            borderRadius: '10px',
            padding: '12px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: '#a6e3a1'
          }}
        >
          {logs.map((log, index) => (
            <div key={index} style={{ wordBreak: 'break-all', opacity: index === logs.length - 1 ? 1 : 0.65 }}>
              <span style={{ color: '#89b4fa', marginRight: '6px' }}>&gt;</span>
              {log}
            </div>
          ))}
          {logs.length === 0 && (
            <div style={{ color: '#585b70', fontStyle: 'italic', textAlign: 'center', marginTop: '50px' }}>
              Belum ada log aktivitas...
            </div>
          )}
          <div ref={logEndRef} />
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            onClick={onClose}
            disabled={!isDone && !isError}
            style={{
              padding: '10px 24px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
              background: isError ? '#f38ba8' : isDone ? '#a6e3a1' : '#313244',
              color: isError ? '#11111b' : isDone ? '#11111b' : '#585b70',
              border: 'none',
              cursor: (isDone || isError) ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s ease',
              boxShadow: (isDone || isError) ? '0 4px 12px rgba(0,0,0,0.15)' : 'none'
            }}
            onMouseEnter={e => {
              if (isDone || isError) {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.filter = 'brightness(1.1)'
              }
            }}
            onMouseLeave={e => {
              if (isDone || isError) {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.filter = 'none'
              }
            }}
          >
            {isError ? 'Gagal & Tutup' : isDone ? 'Selesai' : 'Sedang Memproses...'}
          </button>
        </div>
      </div>

      {/* Tambahan animasi CSS keyframes */}
      <style>{`
        @keyframes indeterminate-slide {
          0% { left: -40%; }
          100% { left: 100%; }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-up {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

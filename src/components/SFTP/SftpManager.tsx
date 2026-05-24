import React, { useState, useEffect, useCallback } from 'react'
import LocalPanel from './LocalPanel'
import RemotePanel from './RemotePanel'

interface SftpManagerProps {
  sessionId: string
  isActive: boolean
}

interface TransferJob {
  id: string
  filename: string
  localPath: string
  remotePath: string
  direction: 'upload' | 'download'
  size: number
  transferred: number
  percent: number
  status: 'pending' | 'transferring' | 'completed' | 'failed'
  error?: string
}

export default function SftpManager({ sessionId, isActive }: SftpManagerProps) {
  const [localRefresh, setLocalRefresh] = useState(0)
  const [remoteRefresh, setRemoteRefresh] = useState(0)
  const [transferQueue, setTransferQueue] = useState<TransferJob[]>([])
  const [showQueue, setShowQueue] = useState(true)
  const [activeTransferPaths, setActiveTransferPaths] = useState<Set<string>>(new Set())

  useEffect(() => {
    const removeProgressListener = window.sshApi.onTransferProgress((progress: any) => {
      setTransferQueue(prevQueue => {
        return prevQueue.map(job => {
          if (job.status === 'completed' || job.status === 'failed') return job
          const matches =
            job.direction === 'download'
              ? job.remotePath === progress.remotePath && job.localPath === progress.localPath
              : job.localPath === progress.localPath && job.remotePath === progress.remotePath
          if (matches) {
            return { ...job, status: 'transferring', transferred: progress.transferred, percent: progress.percent }
          }
          return job
        })
      })
    })
    return () => { removeProgressListener() }
  }, [])

  const handleUpload = useCallback(async (localPath: string, remoteDestPath: string) => {
    if (activeTransferPaths.has(localPath)) {
      alert('File sedang dalam proses transfer!')
      return
    }
    const filename = localPath.split(/[/\\]/).pop() || 'file'
    const jobId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const newJob: TransferJob = { id: jobId, filename, localPath, remotePath: remoteDestPath, direction: 'upload', size: 0, transferred: 0, percent: 0, status: 'pending' }
    setTransferQueue(prev => [newJob, ...prev])
    setActiveTransferPaths(prev => { const n = new Set(prev); n.add(localPath); return n })
    try {
      await window.sshApi.sftpUpload(sessionId, localPath, remoteDestPath)
      setTransferQueue(prev => prev.map(j => (j.id === jobId ? { ...j, status: 'completed', percent: 100 } : j)))
      setRemoteRefresh(prev => prev + 1)
    } catch (err: any) {
      setTransferQueue(prev => prev.map(j => (j.id === jobId ? { ...j, status: 'failed', error: err.message || String(err) } : j)))
    } finally {
      setActiveTransferPaths(prev => { const n = new Set(prev); n.delete(localPath); return n })
    }
  }, [sessionId, activeTransferPaths])

  const handleDownload = useCallback(async (remotePath: string, filename: string) => {
    const result = await window.sshApi.showSaveDialog({ title: 'Download File', defaultPath: filename, buttonLabel: 'Download' })
    if (result.canceled || !result.filePath) return
    const localPath = result.filePath
    if (activeTransferPaths.has(remotePath)) {
      alert('File sedang dalam proses transfer!')
      return
    }
    const jobId = `download-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const newJob: TransferJob = { id: jobId, filename, localPath, remotePath, direction: 'download', size: 0, transferred: 0, percent: 0, status: 'pending' }
    setTransferQueue(prev => [newJob, ...prev])
    setActiveTransferPaths(prev => { const n = new Set(prev); n.add(remotePath); return n })
    try {
      await window.sshApi.sftpDownload(sessionId, remotePath, localPath)
      setTransferQueue(prev => prev.map(j => (j.id === jobId ? { ...j, status: 'completed', percent: 100 } : j)))
      setLocalRefresh(prev => prev + 1)
    } catch (err: any) {
      setTransferQueue(prev => prev.map(j => (j.id === jobId ? { ...j, status: 'failed', error: err.message || String(err) } : j)))
    } finally {
      setActiveTransferPaths(prev => { const n = new Set(prev); n.delete(remotePath); return n })
    }
  }, [sessionId, activeTransferPaths])

  const handleDropUpload = useCallback((localPath: string, remoteDestPath: string) => {
    handleUpload(localPath, remoteDestPath)
  }, [handleUpload])

  const handleContextMenuUpload = useCallback((localPath: string, filename: string) => {
    handleUpload(localPath, `./${filename}`)
  }, [handleUpload])

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const activeJobs = transferQueue.filter(j => j.status === 'pending' || j.status === 'transferring')
  const completedJobs = transferQueue.filter(j => j.status === 'completed')
  const failedJobs = transferQueue.filter(j => j.status === 'failed')

  return (
    <div className="w-full h-full flex flex-col min-w-0 overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Dual Panel Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0 overflow-y-auto lg:overflow-hidden">
        <LocalPanel
          key={`local-${localRefresh}`}
          onUpload={handleContextMenuUpload}
          draggedJob={activeJobs.some(j => j.direction === 'download')}
        />
        <RemotePanel
          key={`remote-${remoteRefresh}`}
          sessionId={sessionId}
          onDownload={handleDownload}
          onDropUpload={handleDropUpload}
          draggedJob={activeJobs.some(j => j.direction === 'upload')}
        />
      </div>

      {/* Transfer Queue */}
      {transferQueue.length > 0 && (
        <div className="transfer-queue">
          {/* Header */}
          <div
            className={`transfer-queue-header ${showQueue ? 'open' : ''}`}
            onClick={() => setShowQueue(prev => !prev)}
          >
            <div className="flex items-center gap-3">
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                style={{
                  color: 'var(--accent)',
                  transition: 'transform 0.2s ease',
                  transform: showQueue ? 'rotate(180deg)' : 'rotate(0deg)'
                }}
              >
                <polyline points="18 15 12 9 6 15"/>
              </svg>
              <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Transfer Queue
              </span>

              <div className="flex items-center gap-2">
                {activeJobs.length > 0 && (
                  <span className="transfer-badge active" style={{ animation: 'status-blink 1.5s ease-in-out infinite' }}>
                    {activeJobs.length} Active
                  </span>
                )}
                {failedJobs.length > 0 && (
                  <span className="transfer-badge error">{failedJobs.length} Failed</span>
                )}
                {completedJobs.length > 0 && (
                  <span className="transfer-badge success">{completedJobs.length} Done</span>
                )}
              </div>
            </div>

            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {showQueue ? 'Hide' : 'Expand'}
            </span>
          </div>

          {/* Job list */}
          {showQueue && (
            <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
              {transferQueue.map((job) => {
                const isUpload = job.direction === 'upload'
                return (
                  <div key={job.id} className="transfer-item">
                    {/* Direction badge */}
                    <div className={`transfer-direction-badge ${isUpload ? 'upload' : 'download'}`}>
                      {isUpload ? '↑' : '↓'}
                    </div>

                    {/* Filename */}
                    <div style={{ width: '38%', minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">
                        {job.filename}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '1px' }}>
                        {isUpload ? 'upload' : 'download'} · {job.filename}
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="flex-1 flex items-center gap-3">
                      {job.status === 'failed' ? (
                        <div style={{ fontSize: '11px', color: 'var(--error)', flex: 1 }} className="truncate" title={job.error}>
                          {job.error || 'Transfer failed'}
                        </div>
                      ) : (
                        <>
                          <div className="progress-bar-track">
                            <div
                              className={`progress-bar-fill ${job.status === 'completed' ? 'completed' : isUpload ? 'upload' : 'download'}`}
                              style={{ width: `${job.percent}%` }}
                            />
                          </div>
                          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', flexShrink: 0, width: '30px', textAlign: 'right' }}>
                            {job.percent}%
                          </span>
                        </>
                      )}
                    </div>

                    {/* Status / size */}
                    <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', width: '15%', textAlign: 'right', flexShrink: 0 }}>
                      {job.status === 'completed' ? (
                        <span style={{ color: 'var(--success)', fontWeight: 700 }}>Done</span>
                      ) : job.status === 'failed' ? (
                        <span style={{ color: 'var(--error)', fontWeight: 700 }}>Error</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>{formatBytes(job.transferred)}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
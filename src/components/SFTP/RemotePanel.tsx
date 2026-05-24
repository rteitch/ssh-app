import React, { useState, useEffect, useRef, useMemo } from 'react'
import type { SFTPFile } from '../../types'

interface RemotePanelProps {
  sessionId: string
  onDownload?: (remotePath: string, filename: string) => void
  onDropUpload?: (localPath: string, remoteDestPath: string) => void
  draggedJob?: boolean
}

// Icons
const FolderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e0af68" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
)

const FileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7aa2f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
)

const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
)

const HomeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
    <path d="M16 16h5v5"/>
  </svg>
)

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

const EyeIcon = ({ slashed }: { slashed: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {slashed ? (
      <>
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
        <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
        <line x1="2" y1="2" x2="22" y2="22"/>
      </>
    ) : (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </>
    )}
  </svg>
)

const SortIcon = ({ active, direction }: { active: boolean, direction: 'asc' | 'desc' }) => {
  if (!active) return <span className="opacity-30 text-[9px] ml-1">⇅</span>
  return <span className="text-[10px] ml-1 text-sky-400">{direction === 'asc' ? '▲' : '▼'}</span>
}

export default function RemotePanel({ sessionId, onDownload, onDropUpload, draggedJob }: RemotePanelProps) {
  const [currentPath, setCurrentPath] = useState<string>('.')
  const [files, setFiles] = useState<SFTPFile[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  
  // Navigation & Search States
  const [pathInput, setPathInput] = useState<string>('.')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showHidden, setShowHidden] = useState<boolean>(false)
  
  // Drag Over highlight state
  const [isDragOver, setIsDragOver] = useState<boolean>(false)
  
  // Sort State
  const [sortKey, setSortKey] = useState<'name' | 'size' | 'date'>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  
  // Selection
  const [selectedFile, setSelectedFile] = useState<SFTPFile | null>(null)
  
  // Dialog States
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: SFTPFile } | null>(null)
  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false)
  const [newFolderName, setNewFolderName] = useState<string>('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false)
  const [showRenameModal, setShowRenameModal] = useState<boolean>(false)
  const [renameValue, setRenameValue] = useState<string>('')
  
  // Chmod Dialog States
  const [showChmodModal, setShowChmodModal] = useState<boolean>(false)
  const [permissions, setPermissions] = useState({
    owner: { read: false, write: false, execute: false },
    group: { read: false, write: false, execute: false },
    others: { read: false, write: false, execute: false }
  })

  const listRef = useRef<HTMLDivElement>(null)

  // Initialize Remote path (root /home mapping)
  useEffect(() => {
    loadRemoteFiles('.')
  }, [sessionId])

  useEffect(() => {
    const handleOutsideClick = () => {
      setContextMenu(null)
    }
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [])

  const loadRemoteFiles = async (targetPath: string) => {
    setLoading(true)
    setError(null)
    setSelectedFile(null)
    try {
      const list = await window.sshApi.sftpList(sessionId, targetPath)
      setFiles(list)
      setCurrentPath(targetPath)
      setPathInput(targetPath)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Gagal mengambil daftar file remote. Pastikan koneksi SSH terhubung.')
    } finally {
      setLoading(false)
    }
  }

  // Navigate Path
  const navigateTo = (targetPath: string) => {
    loadRemoteFiles(targetPath)
  }

  const navigateUp = () => {
    const sep = '/'
    const parts = currentPath.split(sep).filter(Boolean)
    
    if (parts.length <= 1) {
      navigateTo('/')
      return
    }
    
    parts.pop()
    const parent = '/' + parts.join(sep)
    navigateTo(parent)
  }

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pathInput.trim()) {
      navigateTo(pathInput.trim())
    }
  }

  // Double Click directory navigation
  const handleItemDoubleClick = (item: SFTPFile) => {
    const sep = '/'
    let newPath = currentPath
    if (item.isDirectory) {
      if (currentPath.endsWith(sep)) {
        newPath += item.filename
      } else {
        newPath += sep + item.filename
      }
      navigateTo(newPath)
    } else {
      if (onDownload) {
        let fullFilePath = currentPath.endsWith(sep) ? currentPath + item.filename : currentPath + sep + item.filename
        onDownload(fullFilePath, item.filename)
      }
    }
  }

  // Sort and filter files
  const filteredAndSortedFiles = useMemo(() => {
    let result = files.filter(file => {
      // Toggle hidden
      if (!showHidden && file.filename.startsWith('.') && file.filename !== '.') return false
      // Search
      if (searchQuery.trim() && !file.filename.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })

    // Sort
    result.sort((a, b) => {
      // Keep folders on top always
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1

      let fieldA: any = a.filename.toLowerCase()
      let fieldB: any = b.filename.toLowerCase()

      if (sortKey === 'size') {
        fieldA = a.attrs.size
        fieldB = b.attrs.size
      } else if (sortKey === 'date') {
        fieldA = a.attrs.mtime
        fieldB = b.attrs.mtime
      }

      if (fieldA < fieldB) return sortDirection === 'asc' ? -1 : 1
      if (fieldA > fieldB) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [files, showHidden, searchQuery, sortKey, sortDirection])

  const toggleSort = (key: 'name' | 'size' | 'date') => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  // Format Helpers
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDate = (mtimeSec: number) => {
    if (!mtimeSec) return '-'
    const d = new Date(mtimeSec * 1000)
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Parse permissions like drwxr-xr-x or numeric
  const formatPermissions = (mode: number) => {
    if (!mode) return '---------'
    const isDir = (mode & 0o170000) === 0o040000
    const r = (val: number) => (val & 4 ? 'r' : '-')
    const w = (val: number) => (val & 2 ? 'w' : '-')
    const x = (val: number) => (val & 1 ? 'x' : '-')
    
    const u = (mode >> 6) & 7
    const g = (mode >> 3) & 7
    const o = mode & 7

    return `${isDir ? 'd' : '-'}${r(u)}${w(u)}${x(u)}${r(g)}${w(g)}${x(g)}${r(o)}${w(o)}${x(o)}`
  }

  // Context Menu Actions
  const handleContextMenu = (e: React.MouseEvent, file: SFTPFile) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedFile(file)
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      file
    })
  }

  const triggerDownload = () => {
    if (selectedFile && !selectedFile.isDirectory && onDownload) {
      const sep = '/'
      let fullPath = currentPath.endsWith(sep) ? currentPath + selectedFile.filename : currentPath + sep + selectedFile.filename
      onDownload(fullPath, selectedFile.filename)
    }
    setContextMenu(null)
  }

  const handleDelete = async () => {
    if (!selectedFile) return
    const sep = '/'
    const fullPath = currentPath.endsWith(sep) ? currentPath + selectedFile.filename : currentPath + sep + selectedFile.filename
    try {
      await window.sshApi.sftpDelete(sessionId, fullPath)
      loadRemoteFiles(currentPath)
    } catch (err: any) {
      alert(`Gagal menghapus file remote: ${err.message}`)
    } finally {
      setShowDeleteConfirm(false)
      setSelectedFile(null)
    }
  }

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) return
    const sep = '/'
    const fullPath = currentPath.endsWith(sep) ? currentPath + newFolderName.trim() : currentPath + sep + newFolderName.trim()
    try {
      await window.sshApi.sftpMkdir(sessionId, fullPath)
      loadRemoteFiles(currentPath)
      setShowNewFolderModal(false)
      setNewFolderName('')
    } catch (err: any) {
      alert(`Gagal membuat folder remote: ${err.message}`)
    }
  }

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile || !renameValue.trim()) return
    const sep = '/'
    const oldPath = currentPath.endsWith(sep) ? currentPath + selectedFile.filename : currentPath + sep + selectedFile.filename
    const newPath = currentPath.endsWith(sep) ? currentPath + renameValue.trim() : currentPath + sep + renameValue.trim()
    try {
      await window.sshApi.sftpRename(sessionId, oldPath, newPath)
      loadRemoteFiles(currentPath)
      setShowRenameModal(false)
      setSelectedFile(null)
    } catch (err: any) {
      alert(`Gagal me-rename remote item: ${err.message}`)
    }
  }

  // Chmod Permission modal setup
  const openChmodDialog = () => {
    if (!selectedFile) return
    const mode = selectedFile.attrs.mode || 0
    const u = (mode >> 6) & 7
    const g = (mode >> 3) & 7
    const o = mode & 7

    setPermissions({
      owner: { read: !!(u & 4), write: !!(u & 2), execute: !!(u & 1) },
      group: { read: !!(g & 4), write: !!(g & 2), execute: !!(g & 1) },
      others: { read: !!(o & 4), write: !!(o & 2), execute: !!(o & 1) }
    })
    setShowChmodModal(true)
    setContextMenu(null)
  }

  const handleChmodSave = async () => {
    if (!selectedFile) return
    
    // Calculate octal mode from checkbox state
    const calcOctal = (group: { read: boolean; write: boolean; execute: boolean }) => {
      let val = 0
      if (group.read) val += 4
      if (group.write) val += 2
      if (group.execute) val += 1
      return val
    }

    const u = calcOctal(permissions.owner)
    const g = calcOctal(permissions.group)
    const o = calcOctal(permissions.others)
    
    const mode = (u << 6) | (g << 3) | o
    const sep = '/'
    const fullPath = currentPath.endsWith(sep) ? currentPath + selectedFile.filename : currentPath + sep + selectedFile.filename

    try {
      await window.sshApi.sftpChmod(sessionId, fullPath, mode)
      loadRemoteFiles(currentPath)
      setShowChmodModal(false)
      setSelectedFile(null)
    } catch (err: any) {
      alert(`Gagal mengubah permissions: ${err.message}`)
    }
  }

  // HTML5 Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, item: SFTPFile) => {
    if (item.isDirectory) return // SFTP fastGet works easily on files
    const sep = '/'
    const fullPath = currentPath.endsWith(sep) ? currentPath + item.filename : currentPath + sep + item.filename
    
    const dragData = {
      type: 'remote',
      remotePath: fullPath,
      filename: item.filename,
      size: item.attrs.size
    }
    
    e.dataTransfer.setData('text/plain', JSON.stringify(dragData))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    try {
      const dataStr = e.dataTransfer.getData('text/plain')
      if (!dataStr) return
      
      const dragData = JSON.parse(dataStr)
      if (dragData && dragData.type === 'local' && onDropUpload) {
        // Upload dropped local file to current remote path
        const sep = '/'
        let destRemotePath = currentPath.endsWith(sep) ? currentPath + dragData.filename : currentPath + sep + dragData.filename
        onDropUpload(dragData.localPath, destRemotePath)
      }
    } catch (err) {
      console.error('Error during drag drop parsing:', err)
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 flex flex-col min-w-0 bg-[#1e1e2d] rounded-2xl border transition-all duration-150 overflow-hidden shadow-xl ${isDragOver ? 'border-[#89b4fa] bg-[#1e1e2d]/90 ring-2 ring-[#89b4fa]/20' : 'border-[#313244]/80'}`}
    >
      {/* Top Header */}
      <div className="px-5 py-3.5 border-b border-[#313244]/60 flex items-center justify-between gap-4 bg-[#181825]/50">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#a6e3a1] animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#a6adc8]">Remote Server Workspace</span>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowHidden(prev => !prev)}
            className={`p-2 rounded-xl transition-all duration-150 border ${showHidden ? 'bg-[#a6e3a1]/15 border-[#a6e3a1]/35 text-[#a6e3a1]' : 'border-transparent text-[#a6adc8] hover:bg-[#313244]'}`}
            title="Toggle Hidden Files"
          >
            <EyeIcon slashed={!showHidden} />
          </button>
          <button
            onClick={() => loadRemoteFiles(currentPath)}
            className="p-2 text-[#a6adc8] hover:bg-[#313244] rounded-xl border border-transparent transition-all duration-150"
            title="Refresh"
          >
            <RefreshIcon />
          </button>
        </div>
      </div>

      {/* Path Input & Search bar */}
      <div className="px-5 py-3 border-b border-[#313244]/60 bg-[#1e1e2e]/40 space-y-2.5">
        <form onSubmit={handlePathSubmit} className="flex gap-2 items-center">
          <button
            type="button"
            onClick={navigateUp}
            className="p-2 bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] rounded-xl transition-colors shrink-0"
            title="Go Parent Directory"
          >
            <BackIcon />
          </button>
          <button
            type="button"
            onClick={() => navigateTo('/')}
            className="p-2 bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] rounded-xl transition-colors shrink-0"
            title="Go Root /"
          >
            <HomeIcon />
          </button>

          <input
            type="text"
            value={pathInput}
            onChange={e => setPathInput(e.target.value)}
            className="flex-1 bg-[#181825] border border-[#313244] rounded-xl px-4 py-2 text-xs text-[#cdd6f4] outline-none focus:border-[#89b4fa]"
            placeholder="Search path..."
          />
        </form>

        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#585b70]">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#181825] border border-[#313244] rounded-xl pl-9 pr-4 py-2 text-xs text-[#cdd6f4] outline-none focus:border-[#89b4fa]"
            placeholder="Search remote files/folders..."
          />
        </div>
      </div>

      {/* Main File Table List */}
      <div className="flex-1 overflow-y-auto relative" ref={listRef}>
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1e1e2e]/30">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-[#a6e3a1] animate-spin" />
            <span className="text-xs text-[#a6adc8] mt-3">Loading directory...</span>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <span className="text-xs text-[#f38ba8] mb-4 bg-[#f38ba8]/10 px-4 py-3 rounded-2xl border border-[#f38ba8]/20">{error}</span>
            <button
              onClick={() => navigateTo('/')}
              className="px-5 py-2.5 bg-[#313244] text-[#cdd6f4] rounded-xl text-xs font-semibold hover:bg-[#45475a] transition-all"
            >
              Reset to / (Root)
            </button>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#313244]/50 text-[#585b70] uppercase font-bold text-[10px] tracking-wider select-none bg-[#181825]/20 sticky top-0 z-10">
                <th onClick={() => toggleSort('name')} className="px-5 py-3 cursor-pointer hover:text-[#cdd6f4] transition-colors w-full sm:w-[50%] md:w-[50%]">
                  Name <SortIcon active={sortKey === 'name'} direction={sortDirection} />
                </th>
                <th className="px-3 py-3 text-left select-none hidden sm:table-cell sm:w-[15%]">Perms</th>
                <th onClick={() => toggleSort('size')} className="px-4 py-3 cursor-pointer hover:text-[#cdd6f4] transition-colors text-right hidden sm:table-cell sm:w-[15%]">
                  Size <SortIcon active={sortKey === 'size'} direction={sortDirection} />
                </th>
                <th onClick={() => toggleSort('date')} className="px-5 py-3 cursor-pointer hover:text-[#cdd6f4] transition-colors text-right hidden md:table-cell md:w-[20%]">
                  Modified <SortIcon active={sortKey === 'date'} direction={sortDirection} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#313244]/20">
              {filteredAndSortedFiles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-[#585b70]">
                    Direktori kosong
                  </td>
                </tr>
              ) : (
                filteredAndSortedFiles.map((file) => {
                  const isSelected = selectedFile?.filename === file.filename
                  return (
                    <tr
                      key={file.filename}
                      draggable={!file.isDirectory}
                      onDragStart={(e) => handleDragStart(e, file)}
                      onClick={() => setSelectedFile(file)}
                      onDoubleClick={() => handleItemDoubleClick(file)}
                      onContextMenu={(e) => handleContextMenu(e, file)}
                      className={`hover:bg-[#313244]/40 cursor-pointer select-none transition-colors duration-100 ${isSelected ? 'bg-[#a6e3a1]/10 text-[#a6e3a1]' : 'text-[#cdd6f4]'}`}
                    >
                      <td className="px-5 py-2.5 font-medium flex items-center gap-3 truncate max-w-0">
                        {file.isDirectory ? <FolderIcon /> : <FileIcon />}
                        <span className="truncate">{file.filename}</span>
                      </td>
                      <td className="px-3 py-2.5 text-left font-mono text-[#a6adc8] select-none hidden sm:table-cell">
                        {formatPermissions(file.attrs.mode)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#a6adc8] hidden sm:table-cell">
                        {file.isDirectory ? '-' : formatBytes(file.attrs.size)}
                      </td>
                      <td className="px-5 py-2.5 text-right text-[#a6adc8] hidden md:table-cell">
                        {formatDate(file.attrs.mtime)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Context Menu Dialog */}
      {contextMenu && (
        <div
          className="fixed rounded-xl shadow-2xl py-2 z-[90] bg-[#313244]/90 backdrop-blur-md border border-[#45475a]/80 min-width-[160px] animate-fade-in"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {onDownload && !contextMenu.file.isDirectory && (
            <button
              onClick={triggerDownload}
              className="w-full px-4 py-2.5 text-xs font-semibold text-left flex items-center gap-3.5 text-[#a6e3a1] hover:bg-[#181825]"
            >
              Download Ke Lokal ➜
            </button>
          )}
          <button
            onClick={() => {
              setRenameValue(contextMenu.file.filename)
              setShowRenameModal(true)
              setContextMenu(null)
            }}
            className="w-full px-4 py-2.5 text-xs font-medium text-left flex items-center gap-3.5 text-[#cdd6f4] hover:bg-[#181825]"
          >
            Rename File
          </button>
          <button
            onClick={openChmodDialog}
            className="w-full px-4 py-2.5 text-xs font-medium text-left flex items-center gap-3.5 text-[#cdd6f4] hover:bg-[#181825]"
          >
            Chmod (Permissions)
          </button>
          <div className="border-t border-[#45475a]/50 my-1.5" />
          <button
            onClick={() => {
              setShowNewFolderModal(true)
              setContextMenu(null)
            }}
            className="w-full px-4 py-2.5 text-xs font-medium text-left flex items-center gap-3.5 text-[#cdd6f4] hover:bg-[#181825]"
          >
            Folder Baru
          </button>
          <button
            onClick={() => {
              setShowDeleteConfirm(true)
              setContextMenu(null)
            }}
            className="w-full px-4 py-2.5 text-xs font-medium text-left flex items-center gap-3.5 text-[#f38ba8] hover:bg-[#f38ba8]/10"
          >
            Hapus Item
          </button>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowNewFolderModal(false)}>
          <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl w-full max-w-[380px] p-6 shadow-2xl animate-slide-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-4 text-[#cdd6f4]">Buat Folder Baru Remote</h3>
            <form onSubmit={handleCreateFolder}>
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="Nama folder baru..."
                className="w-full bg-[#181825] border border-[#313244] rounded-xl px-4 py-3 text-xs text-[#cdd6f4] outline-none mb-5 focus:border-[#89b4fa]"
              />
              <div className="flex justify-end gap-3.5">
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#313244] text-[#a6adc8] text-xs hover:border-[#45475a] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#89b4fa] text-[#1e1e2e] text-xs font-semibold hover:opacity-90 transition-all"
                >
                  Buat Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowRenameModal(false)}>
          <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl w-full max-w-[380px] p-6 shadow-2xl animate-slide-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-4 text-[#cdd6f4]">Rename Remote File</h3>
            <form onSubmit={handleRename}>
              <input
                type="text"
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                placeholder="Nama remote baru..."
                className="w-full bg-[#181825] border border-[#313244] rounded-xl px-4 py-3 text-xs text-[#cdd6f4] outline-none mb-5 focus:border-[#89b4fa]"
              />
              <div className="flex justify-end gap-3.5">
                <button
                  type="button"
                  onClick={() => setShowRenameModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#313244] text-[#a6adc8] text-xs hover:border-[#45475a] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#89b4fa] text-[#1e1e2e] text-xs font-semibold hover:opacity-90 transition-all"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Destructive Delete Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-[#1e1e2e] border border-[#f38ba8]/30 rounded-2xl w-full max-w-[400px] p-6 shadow-2xl animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3.5 mb-3.5 text-[#f38ba8]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <h3 className="text-sm font-bold text-[#cdd6f4]">Konfirmasi Hapus Remote</h3>
            </div>
            <p className="text-xs text-[#a6adc8] leading-relaxed mb-6">
              Apakah Anda yakin ingin menghapus remote item <strong className="text-[#cdd6f4]">"{selectedFile?.filename}"</strong> dari server? Ini akan menghapusnya secara permanen.
            </p>
            <div className="flex justify-end gap-3.5">
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setSelectedFile(null) }}
                className="px-4 py-2.5 rounded-xl border border-[#313244] text-[#a6adc8] text-xs hover:border-[#45475a] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-5 py-2.5 rounded-xl bg-[#f38ba8] text-[#1e1e2e] text-xs font-semibold hover:opacity-90 transition-all shadow-[0_4px_12px_rgba(243,139,168,0.2)]"
              >
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Chmod Checkbox Modal */}
      {showChmodModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowChmodModal(false)}>
          <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl w-full max-w-[450px] p-6 shadow-2xl animate-slide-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-[#cdd6f4] mb-1.5">Ubah Permissions (Chmod)</h3>
            <p className="text-[11px] text-[#a6adc8] mb-5">
              Menyetel hak akses berkas untuk berkas <strong className="text-[#cdd6f4]">"{selectedFile?.filename}"</strong>.
            </p>
            
            <div className="grid grid-cols-4 gap-4 mb-6 select-none">
              <div className="text-[10px] text-[#585b70] font-bold uppercase tracking-wider">Role</div>
              <div className="text-[10px] text-[#585b70] font-bold uppercase tracking-wider text-center">Read (4)</div>
              <div className="text-[10px] text-[#585b70] font-bold uppercase tracking-wider text-center">Write (2)</div>
              <div className="text-[10px] text-[#585b70] font-bold uppercase tracking-wider text-center">Execute (1)</div>

              {/* Owner row */}
              <div className="text-xs font-semibold text-[#cdd6f4] flex items-center">Owner</div>
              {['read', 'write', 'execute'].map((perm) => (
                <div key={`owner-${perm}`} className="flex justify-center">
                  <input
                    type="checkbox"
                    checked={(permissions.owner as any)[perm]}
                    onChange={(e) => setPermissions(prev => ({
                      ...prev,
                      owner: { ...prev.owner, [perm]: e.target.checked }
                    }))}
                    className="w-4 h-4 rounded border-[#313244] bg-[#181825] text-[#89b4fa] focus:ring-0"
                  />
                </div>
              ))}

              {/* Group row */}
              <div className="text-xs font-semibold text-[#cdd6f4] flex items-center">Group</div>
              {['read', 'write', 'execute'].map((perm) => (
                <div key={`group-${perm}`} className="flex justify-center">
                  <input
                    type="checkbox"
                    checked={(permissions.group as any)[perm]}
                    onChange={(e) => setPermissions(prev => ({
                      ...prev,
                      group: { ...prev.group, [perm]: e.target.checked }
                    }))}
                    className="w-4 h-4 rounded border-[#313244] bg-[#181825] text-[#89b4fa] focus:ring-0"
                  />
                </div>
              ))}

              {/* Others row */}
              <div className="text-xs font-semibold text-[#cdd6f4] flex items-center">Others</div>
              {['read', 'write', 'execute'].map((perm) => (
                <div key={`others-${perm}`} className="flex justify-center">
                  <input
                    type="checkbox"
                    checked={(permissions.others as any)[perm]}
                    onChange={(e) => setPermissions(prev => ({
                      ...prev,
                      others: { ...prev.others, [perm]: e.target.checked }
                    }))}
                    className="w-4 h-4 rounded border-[#313244] bg-[#181825] text-[#89b4fa] focus:ring-0"
                  />
                </div>
              ))}
            </div>

            {/* Display Octal Mode */}
            <div className="p-4 bg-[#181825] rounded-xl flex items-center justify-between mb-6 border border-[#313244]">
              <span className="text-xs text-[#a6adc8]">Numeric Value:</span>
              <span className="text-sm font-bold font-mono text-[#89b4fa]">
                0{
                  ((permissions.owner.read ? 4 : 0) + (permissions.owner.write ? 2 : 0) + (permissions.owner.execute ? 1 : 0))
                }{
                  ((permissions.group.read ? 4 : 0) + (permissions.group.write ? 2 : 0) + (permissions.group.execute ? 1 : 0))
                }{
                  ((permissions.others.read ? 4 : 0) + (permissions.others.write ? 2 : 0) + (permissions.others.execute ? 1 : 0))
                }
              </span>
            </div>

            <div className="flex justify-end gap-3.5">
              <button
                type="button"
                onClick={() => setShowChmodModal(false)}
                className="px-4 py-2.5 rounded-xl border border-[#313244] text-[#a6adc8] text-xs hover:border-[#45475a] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleChmodSave}
                className="px-5 py-2.5 rounded-xl bg-[#a6e3a1] text-[#1e1e2e] text-xs font-semibold hover:opacity-90 transition-all"
              >
                Simpan Permissions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

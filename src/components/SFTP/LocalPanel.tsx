import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { SFTPFile } from '../../types'

interface LocalPanelProps {
  onUpload?: (filePath: string, filename: string) => void
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

export default function LocalPanel({ onUpload, draggedJob }: LocalPanelProps) {
  const [currentPath, setCurrentPath] = useState<string>('')
  const [files, setFiles] = useState<SFTPFile[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  
  // Navigation & Search States
  const [pathInput, setPathInput] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showHidden, setShowHidden] = useState<boolean>(false)
  
  // Sort State
  const [sortKey, setSortKey] = useState<'name' | 'size' | 'date'>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  
  // Selection
  const [selectedFile, setSelectedFile] = useState<SFTPFile | null>(null)
  
  // Context Menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: SFTPFile } | null>(null)
  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false)
  const [newFolderName, setNewFolderName] = useState<string>('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false)
  const [showRenameModal, setShowRenameModal] = useState<boolean>(false)
  const [renameValue, setRenameValue] = useState<string>('')

  const listRef = useRef<HTMLDivElement>(null)

  const loadLocalFiles = useCallback(async (targetPath: string) => {
    setLoading(true)
    setError(null)
    setSelectedFile(null)
    try {
      const list = await window.sshApi.fsListLocal(targetPath)
      setFiles(list)
      setCurrentPath(targetPath)
      setPathInput(targetPath)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Gagal mengambil daftar file lokal.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initialize Home path
  useEffect(() => {
    window.sshApi.fsGetHomeDir().then(home => {
      setCurrentPath(home)
      setPathInput(home)
      loadLocalFiles(home)
    }).catch(err => {
      console.error(err)
      setError('Gagal membaca direktori awal pengguna.')
      setLoading(false)
    })
  }, [loadLocalFiles])

  // Close context menus on outside click
  useEffect(() => {
    const handleOutsideClick = () => {
      setContextMenu(null)
    }
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [])

  // Navigate Path
  const navigateTo = (targetPath: string) => {
    loadLocalFiles(targetPath)
  }

  const navigateUp = () => {
    const isWindows = currentPath.includes('\\') || /^[a-zA-Z]:/.test(currentPath)
    const sep = isWindows ? '\\' : '/'
    const parts = currentPath.split(sep).filter(Boolean)
    
    if (parts.length <= 1) {
      if (isWindows && /^[a-zA-Z]:$/.test(currentPath)) {
        return // Already at drive root
      }
      navigateTo(sep)
      return
    }
    
    parts.pop()
    let parent = parts.join(sep)
    if (isWindows && !/^[a-zA-Z]:/.test(parent)) {
      parent = currentPath.startsWith('\\\\') ? '\\\\' + parent : 'C:\\' + parent
    } else if (!isWindows) {
      parent = '/' + parent
    }
    navigateTo(parent)
  }

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pathInput.trim()) {
      navigateTo(pathInput.trim())
    }
  }

  // Double Click file/folder action
  const handleItemDoubleClick = (item: SFTPFile) => {
    const isWindows = currentPath.includes('\\') || /^[a-zA-Z]:/.test(currentPath)
    const sep = isWindows ? '\\' : '/'
    let newPath = currentPath
    if (item.isDirectory) {
      if (currentPath.endsWith(sep)) {
        newPath += item.filename
      } else {
        newPath += sep + item.filename
      }
      navigateTo(newPath)
    } else {
      if (onUpload) {
        let fullFilePath = currentPath.endsWith(sep) ? currentPath + item.filename : currentPath + sep + item.filename
        onUpload(fullFilePath, item.filename)
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

  // Format Helper
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

  const triggerUpload = () => {
    if (selectedFile && !selectedFile.isDirectory && onUpload) {
      const isWindows = currentPath.includes('\\') || /^[a-zA-Z]:/.test(currentPath)
      const sep = isWindows ? '\\' : '/'
      let fullPath = currentPath.endsWith(sep) ? currentPath + selectedFile.filename : currentPath + sep + selectedFile.filename
      onUpload(fullPath, selectedFile.filename)
    }
    setContextMenu(null)
  }

  const handleDelete = async () => {
    if (!selectedFile) return
    const isWindows = currentPath.includes('\\') || /^[a-zA-Z]:/.test(currentPath)
    const sep = isWindows ? '\\' : '/'
    const fullPath = currentPath.endsWith(sep) ? currentPath + selectedFile.filename : currentPath + sep + selectedFile.filename
    try {
      await window.sshApi.fsDeleteLocal(fullPath)
      loadLocalFiles(currentPath)
    } catch (err: any) {
      alert(`Gagal menghapus file: ${err.message}`)
    } finally {
      setShowDeleteConfirm(false)
      setSelectedFile(null)
    }
  }

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) return
    const isWindows = currentPath.includes('\\') || /^[a-zA-Z]:/.test(currentPath)
    const sep = isWindows ? '\\' : '/'
    const fullPath = currentPath.endsWith(sep) ? currentPath + newFolderName.trim() : currentPath + sep + newFolderName.trim()
    try {
      await window.sshApi.fsMkdirLocal(fullPath)
      loadLocalFiles(currentPath)
      setShowNewFolderModal(false)
      setNewFolderName('')
    } catch (err: any) {
      alert(`Gagal membuat folder: ${err.message}`)
    }
  }

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile || !renameValue.trim()) return
    const isWindows = currentPath.includes('\\') || /^[a-zA-Z]:/.test(currentPath)
    const sep = isWindows ? '\\' : '/'
    const oldPath = currentPath.endsWith(sep) ? currentPath + selectedFile.filename : currentPath + sep + selectedFile.filename
    const newPath = currentPath.endsWith(sep) ? currentPath + renameValue.trim() : currentPath + sep + renameValue.trim()
    try {
      await window.sshApi.fsRenameLocal(oldPath, newPath)
      loadLocalFiles(currentPath)
      setShowRenameModal(false)
      setSelectedFile(null)
    } catch (err: any) {
      alert(`Gagal me-rename: ${err.message}`)
    }
  }

  // HTML5 Drag Handlers
  const handleDragStart = (e: React.DragEvent, item: SFTPFile) => {
    if (item.isDirectory) return // SFTP fastPut handles single files easily
    const isWindows = currentPath.includes('\\') || /^[a-zA-Z]:/.test(currentPath)
    const sep = isWindows ? '\\' : '/'
    const fullPath = currentPath.endsWith(sep) ? currentPath + item.filename : currentPath + sep + item.filename
    
    const dragData = {
      type: 'local',
      localPath: fullPath,
      filename: item.filename,
      size: item.attrs.size
    }
    
    e.dataTransfer.setData('text/plain', JSON.stringify(dragData))
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e2d] rounded-2xl border border-[#313244]/80 overflow-hidden shadow-xl">
      {/* Top Header */}
      <div className="px-5 py-3.5 border-b border-[#313244]/60 flex items-center justify-between gap-4 bg-[#181825]/50">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#89b4fa]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#a6adc8]">Local Workspace</span>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowHidden(prev => !prev)}
            className={`p-2 rounded-xl transition-all duration-150 border ${showHidden ? 'bg-[#89b4fa]/15 border-[#89b4fa]/35 text-[#89b4fa]' : 'border-transparent text-[#a6adc8] hover:bg-[#313244]'}`}
            title="Toggle Hidden Files"
          >
            <EyeIcon slashed={!showHidden} />
          </button>
          <button
            onClick={() => loadLocalFiles(currentPath)}
            className="p-2 text-[#a6adc8] hover:bg-[#313244] rounded-xl border border-transparent transition-all duration-150"
            title="Refresh"
          >
            <RefreshIcon />
          </button>
        </div>
      </div>

      {/* Path Breadcrumbs / Path Input & Search bar */}
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
            onClick={async () => {
              const home = await window.sshApi.fsGetHomeDir()
              navigateTo(home)
            }}
            className="p-2 bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] rounded-xl transition-colors shrink-0"
            title="Go User Home"
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
            placeholder="Search files/folders in directory..."
          />
        </div>
      </div>

      {/* Main File Table List */}
      <div className="flex-1 overflow-y-auto relative" ref={listRef}>
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1e1e2e]/30">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-[#89b4fa] animate-spin" />
            <span className="text-xs text-[#a6adc8] mt-3">Loading directory...</span>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <span className="text-xs text-[#f38ba8] mb-4 bg-[#f38ba8]/10 px-4 py-3 rounded-2xl border border-[#f38ba8]/20">{error}</span>
            <button
              onClick={() => window.sshApi.fsGetHomeDir().then(navigateTo)}
              className="px-5 py-2.5 bg-[#313244] text-[#cdd6f4] rounded-xl text-xs font-semibold hover:bg-[#45475a] transition-all"
            >
              Reset to User Home
            </button>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#313244]/50 text-[#585b70] uppercase font-bold text-[10px] tracking-wider select-none bg-[#181825]/20 sticky top-0 z-10">
                <th onClick={() => toggleSort('name')} className="px-5 py-3 cursor-pointer hover:text-[#cdd6f4] transition-colors w-full sm:w-[60%] md:w-[60%]">
                  Name <SortIcon active={sortKey === 'name'} direction={sortDirection} />
                </th>
                <th onClick={() => toggleSort('size')} className="px-4 py-3 cursor-pointer hover:text-[#cdd6f4] transition-colors text-right hidden sm:table-cell sm:w-[15%] md:w-[15%]">
                  Size <SortIcon active={sortKey === 'size'} direction={sortDirection} />
                </th>
                <th onClick={() => toggleSort('date')} className="px-5 py-3 cursor-pointer hover:text-[#cdd6f4] transition-colors text-right hidden md:table-cell md:w-[25%]">
                  Modified <SortIcon active={sortKey === 'date'} direction={sortDirection} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#313244]/20">
              {filteredAndSortedFiles.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-10 text-[#585b70]">
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
                      className={`hover:bg-[#313244]/40 cursor-pointer select-none transition-colors duration-100 ${isSelected ? 'bg-[#89b4fa]/10 text-[#89b4fa]' : 'text-[#cdd6f4]'}`}
                    >
                      <td className="px-5 py-2.5 font-medium flex items-center gap-3 truncate">
                        {file.isDirectory ? <FolderIcon /> : <FileIcon />}
                        <span className="truncate">{file.filename}</span>
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
          {onUpload && !contextMenu.file.isDirectory && (
            <button
              onClick={triggerUpload}
              className="w-full px-4 py-2.5 text-xs font-semibold text-left flex items-center gap-3.5 text-[#89b4fa] hover:bg-[#181825]"
            >
              Upload Ke Remote ➜
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
            <h3 className="text-sm font-semibold mb-4 text-[#cdd6f4]">Buat Folder Baru</h3>
            <form onSubmit={handleCreateFolder}>
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="Nama folder..."
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
            <h3 className="text-sm font-semibold mb-4 text-[#cdd6f4]">Rename File/Folder</h3>
            <form onSubmit={handleRename}>
              <input
                type="text"
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                placeholder="Nama baru..."
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

      {/* Safety Deletion Confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-[#1e1e2e] border border-[#f38ba8]/30 rounded-2xl w-full max-w-[400px] p-6 shadow-2xl animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3.5 mb-3.5 text-[#f38ba8]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <h3 className="text-sm font-bold text-[#cdd6f4]">Konfirmasi Hapus</h3>
            </div>
            <p className="text-xs text-[#a6adc8] leading-relaxed mb-6">
              Apakah Anda yakin ingin menghapus item <strong className="text-[#cdd6f4]">"{selectedFile?.filename}"</strong> secara permanen? Aksi ini tidak dapat dibatalkan.
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
    </div>
  )
}

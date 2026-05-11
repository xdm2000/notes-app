'use client'

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import dynamic from 'next/dynamic'

const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false })
import {
  Search, Plus, Tag, Trash2, Edit3, Eye, Moon, Sun,
  Download, FileText, X, Check, FolderOpen, Loader2,
  Star, Clock, Hash, ArrowUpDown, FileUp, ChevronDown,
  AlignLeft, Maximize2, Minimize2, Zap, MoreHorizontal
} from 'lucide-react'

// ========== 类型定义 ==========
interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
  starred?: boolean
}

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

type SortOption = 'updated' | 'created' | 'title' | 'starred'

// ========== 工具函数 ==========
function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

function getReadingTime(text: string): number {
  return Math.max(1, Math.ceil(countWords(text) / 200))
}

function formatDate(date: string): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) {
    return '今天 ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } else if (days === 1) {
    return '昨天'
  } else if (days < 7) {
    return `${days} 天前`
  } else {
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }
}

// ========== Toast 组件 ==========
function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: number) => void }) {
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
          onClick={() => removeToast(toast.id)}
        >
          {toast.type === 'success' && <span style={{ color: 'var(--mint)' }}>✓</span>}
          {toast.type === 'error' && <span style={{ color: 'var(--rose)' }}>✕</span>}
          {toast.type === 'info' && <span style={{ color: 'var(--accent)' }}>☕</span>}
          {toast.message}
        </div>
      ))}
    </div>
  )
}

// ========== 笔记列表项（已 memo 优化） ==========
const NoteListItem = memo(function NoteListItem({
  note, isSelected, onSelect
}: {
  note: Note; isSelected: boolean; onSelect: (id: string) => void
}) {
  return (
    <button
      onClick={() => onSelect(note.id)}
      className="w-full text-left p-4 rounded-2xl mb-2 transition-all animate-fadeIn"
      style={{
        background: isSelected ? 'var(--accent-light)' : 'transparent',
        border: isSelected ? '2.5px solid var(--accent)' : '2.5px solid transparent',
        boxShadow: isSelected ? '0 0 24px var(--accent-glow)' : 'none'
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {note.starred && <Star size={14} fill="var(--amber)" color="var(--amber)" />}
            <span className="font-bold text-base truncate" style={{ color: 'var(--text-primary)' }}>
              {note.title || '未命名'}
            </span>
          </div>
          <div className="text-sm mt-1.5 truncate italic" style={{ color: 'var(--text-muted)' }}>
            {note.content.slice(0, 80) || '空笔记'}
          </div>
        </div>
        <span className="text-sm flex-shrink-0 font-semibold" style={{ color: 'var(--text-muted)' }}>
          {formatDate(note.updatedAt)}
        </span>
      </div>
      {note.tags.length > 0 && (
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {note.tags.slice(0, 3).map(t => (
            <span
              key={t}
              className="text-xs font-bold px-2.5 py-1 rounded-lg"
              style={{ background: 'var(--tag-bg)', color: 'var(--tag-text)' }}
            >
              #{t}
            </span>
          ))}
          {note.tags.length > 3 && (
            <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
              +{note.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </button>
  )
})

// ========== 主应用 ==========
export default function NotesApp() {
  // 状态
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [sortBy, setSortBy] = useState<SortOption>('updated')
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle')
  const [showShortcuts, setShowShortcuts] = useState(false)
  const editRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toastIdRef = useRef(0)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchTimerRef = useRef<NodeJS.Timeout>()

  // Toast 提示
  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  // 初始化
  useEffect(() => {
    fetchNotes()
    const saved = localStorage.getItem('notes-darkMode')
    if (saved) {
      setDarkMode(saved === 'true')
    } else {
      setDarkMode(window.matchMedia('(prefer-color-scheme: dark)').matches)
    }
    setMounted(true)
  }, [])

  // 主题切换动画
  useEffect(() => {
    if (!mounted) return
    document.documentElement.classList.add('theme-transition')
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('notes-darkMode', String(darkMode))
    const timer = setTimeout(() => {
      document.documentElement.classList.remove('theme-transition')
    }, 500)
    return () => clearTimeout(timer)
  }, [darkMode, mounted])

  // 键盘快捷键
  useEffect(() => {
    if (!mounted) return
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N: 新建
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        createNote()
      }
      // Ctrl/Cmd + S: 保存
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (selectedId && !isEditing) {
          setIsEditing(true)
          setTimeout(() => editRef.current?.focus(), 100)
        }
      }
      // Ctrl/Cmd + B: 切换侧边栏
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        setSidebarOpen(prev => !prev)
      }
      // Escape: 退出编辑
      if (e.key === 'Escape' && isEditing) {
        setIsEditing(false)
      }
      // ?: 显示快捷键
      if (e.key === '?' && !isEditing) {
        setShowShortcuts(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mounted, selectedId, isEditing])

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 150)
    return () => clearTimeout(timer)
  }, [search])

  // ========== API 调用 ==========
  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/notes')
      const data = await res.json()
      // 合并本地收藏状态
      const localStarred = JSON.parse(localStorage.getItem('notes-starred') || '{}')
      const notesWithStars = data.map((n: Note) => ({
        ...n,
        starred: localStarred[n.id] || false
      }))
      setNotes(notesWithStars)
    } catch (err) {
      console.error('加载笔记失败:', err)
      showToast('加载笔记失败', 'error')
    }
  }, [showToast])

  const createNoteAPI = useCallback(async (note: Partial<Note>) => {
    setLoading(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note)
      })
      const newNote = await res.json()
      const noteWithStar: Note = { ...newNote, starred: false }
      setNotes(prev => [noteWithStar, ...prev])
      setSelectedId(newNote.id)
      setIsEditing(true)
      setTimeout(() => editRef.current?.focus(), 100)
      showToast('新笔记已出炉 🧁✨', 'success')
    } catch (err) {
      console.error('创建笔记失败:', err)
      showToast('创建笔记失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  const updateNoteAPI = useCallback(async (id: string, updates: Partial<Note>) => {
    setSaveStatus('saving')
    try {
      await fetch(`/api/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      console.error('更新笔记失败:', err)
      showToast('保存失败', 'error')
      setSaveStatus('idle')
    }
  }, [showToast])

  const deleteNoteAPI = useCallback(async (id: string) => {
    try {
      await fetch(`/api/notes/${id}`, { method: 'DELETE' })
      setNotes(prev => prev.filter(n => n.id !== id))
      if (selectedId === id) setSelectedId(null)
      showToast('笔记已删除', 'info')
    } catch (err) {
      console.error('删除笔记失败:', err)
      showToast('删除失败', 'error')
    }
  }, [selectedId, showToast])

  // ========== 计算属性 ==========
  // 所有标签
  const allTags = useMemo(() => {
    return [...new Set(notes.flatMap(n => n.tags))].sort()
  }, [notes])

  // 筛选和排序
  const filteredNotes = useMemo(() => {
    let result = notes.filter(n => {
      const matchSearch = !debouncedSearch ||
        n.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        n.content.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        n.tags.some(t => t.toLowerCase().includes(debouncedSearch.toLowerCase()))
      const matchTag = !filterTag || n.tags.includes(filterTag)
      return matchSearch && matchTag
    })
    
    // 排序
    result.sort((a, b) => {
      switch (sortBy) {
        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'title':
          return a.title.localeCompare(b.title, 'zh-CN')
        case 'starred':
          return (b.starred ? 1 : 0) - (a.starred ? 1 : 0)
        default:
          return 0
      }
    })
    
    return result
  }, [notes, debouncedSearch, filterTag, sortBy])

  const selectedNote = notes.find(n => n.id === selectedId)

  // ========== 操作 ==========
  const createNote = useCallback(() => {
    createNoteAPI({
      title: '无标题笔记',
      content: '',
      tags: filterTag ? [filterTag] : []
    })
  }, [filterTag, createNoteAPI])

  const updateNote = useCallback((id: string, updates: Partial<Note>) => {
    setNotes(prev => prev.map(n =>
      n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
    ))
    updateNoteAPI(id, updates)
  }, [updateNoteAPI])

  const deleteNote = useCallback((id: string) => {
    if (confirm('确定删除这条笔记吗？此操作不可恢复。')) {
      deleteNoteAPI(id)
    }
  }, [deleteNoteAPI])

  const handleSelectNote = useCallback((id: string) => {
    setSelectedId(id)
    setIsEditing(false)
  }, [])

  const toggleStar = useCallback((id: string) => {
    let newStarred = false
    setNotes(prev => {
      const updated = prev.map(n => {
        if (n.id === id) {
          newStarred = !n.starred
          return { ...n, starred: newStarred }
        }
        return n
      })
      return updated
    })
    const starred = JSON.parse(localStorage.getItem('notes-starred') || '{}')
    starred[id] = newStarred
    localStorage.setItem('notes-starred', JSON.stringify(starred))
    showToast(newStarred ? '已收藏 🌟' : '已取消收藏', 'success')
  }, [showToast])

  const addTag = useCallback(() => {
    if (!selectedId || !tagInput.trim()) return
    const note = notes.find(n => n.id === selectedId)
    if (note && !note.tags.includes(tagInput.trim())) {
      updateNote(selectedId, { tags: [...note.tags, tagInput.trim()] })
    }
    setTagInput('')
  }, [selectedId, tagInput, notes, updateNote])

  const removeTag = useCallback((tag: string) => {
    if (!selectedId) return
    const note = notes.find(n => n.id === selectedId)
    if (note) updateNote(selectedId, { tags: note.tags.filter(t => t !== tag) })
  }, [selectedId, notes, updateNote])

  // 导入 Markdown
  const importMarkdown = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      const title = file.name.replace(/\.md$/, '')
      createNoteAPI({
        title,
        content,
        tags: ['导入']
      })
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [createNoteAPI])

  // 导出
  const exportHTML = useCallback(() => {
    if (!selectedNote) return
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${selectedNote.title}</title>
<style>body{max-width:800px;margin:2em auto;padding:0 1em;font-family:system-ui,serif;line-height:1.8;color:#3C2415;background:#FFF8F0}h1{color:#C8784A;font-weight:800;border-bottom:2px solid #EDE0CC;padding-bottom:.5em}h2{color:#7C5E3C}code{background:#F5E6D3;color:#B0683C;padding:2px 6px;border-radius:4px;font-weight:500}pre{background:#F5EDE0;padding:1em;border-radius:8px;overflow-x:auto;border:1px solid #EDE0CC}blockquote{border-left:4px solid #C8784A;padding:.5em 1em;color:#7C5E3C;background:#F5E6D3;border-radius:0 8px 8px 0}hr{border:none;height:2px;background:linear-gradient(90deg,#C8784A,#D4A050);margin:2em 0;opacity:.3}img{border-radius:12px;max-width:100%}</style>
</head><body><h1>${selectedNote.title}</h1>${selectedNote.tags.map(t => `<span style="background:#EDE0CC;color:#8B5E3C;padding:2px 10px;border-radius:9999px;font-size:0.85em;font-weight:500;margin-right:4px">${t}</span>`).join('')}<hr><div>${selectedNote.content}</div></body></html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${selectedNote.title}.html`; a.click()
    URL.revokeObjectURL(url)
    showToast('HTML 导出成功 🎨', 'success')
  }, [selectedNote, showToast])

  const exportMarkdown = useCallback(() => {
    if (!selectedNote) return
    const md = `# ${selectedNote.title}\n\n${selectedNote.tags.map(t => `\`${t}\``).join(' ')}\n\n---\n\n${selectedNote.content}`
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${selectedNote.title}.md`; a.click()
    URL.revokeObjectURL(url)
    showToast('Markdown 导出成功 📝', 'success')
  }, [selectedNote, showToast])

  const exportAll = useCallback(() => {
    const data = JSON.stringify(notes, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `notes-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    URL.revokeObjectURL(url)
    showToast('全部笔记已导出 💾', 'success')
  }, [notes, showToast])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  if (!mounted) return null

  return (
    <div className="flex h-screen overflow-hidden relative" style={{ background: 'var(--bg-primary)' }}>
      {/* 装饰性背景光晕 */}
      <div className="fixed top-[-30%] left-[-15%] w-[70%] h-[70%] rounded-full opacity-[0.1] pointer-events-none animate-float" style={{ background: 'radial-gradient(ellipse, var(--accent) 0%, transparent 70%)' }} />
      <div className="fixed bottom-[-25%] right-[-15%] w-[60%] h-[60%] rounded-full opacity-[0.08] pointer-events-none animate-float" style={{ background: 'radial-gradient(ellipse, var(--lavender) 0%, transparent 70%)' }} />
      <div className="fixed top-[-10%] right-[-5%] w-[30%] h-[30%] rounded-full opacity-[0.06] pointer-events-none animate-float" style={{ background: 'radial-gradient(ellipse, var(--mint) 0%, transparent 70%)', animationDelay: '-2s' }} />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* 隐藏的文件导入 */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".md,.txt"
        onChange={importMarkdown}
        style={{ display: 'none' }}
      />

      {/* ====== 侧边栏 ====== */}
      <aside
        className={`${sidebarOpen ? 'w-72' : 'w-0'} flex-shrink-0 flex flex-col border-r overflow-hidden transition-all duration-300 relative z-10`}
        style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-color)' }}
      >
        <div className="flex flex-col h-full" style={{ width: '288px' }}>
          {/* 侧边栏头部 */}
          <div className="p-6 pb-5 flex items-center justify-between border-b relative overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
            <div className="absolute inset-0 opacity-[0.05]" style={{ background: 'var(--gradient-macaron)' }} />
            <div className="flex items-center gap-4 relative">
              <span className="text-3xl animate-wiggle" style={{ filter: 'drop-shadow(0 3px 12px var(--accent-glow))' }}>🧁</span>
              <div>
                <span className="title-decorated text-2xl font-black" style={{ color: 'var(--accent)' }}>笔记本</span>
                <div className="text-xs font-bold tracking-[0.25em] uppercase mt-0.5" style={{ color: 'var(--text-muted)' }}>Notebook</div>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2.5 rounded-xl transition-all hover:bg-[var(--accent-light)] hover:scale-110 active:scale-95"
            >
              <X size={18} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>

          {/* 搜索框 */}
          <div className="p-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="搜索笔记..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3.5 rounded-2xl text-base outline-none border-2 transition-all"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
          </div>

          {/* 排序选项 */}
          <div className="px-3 pb-2">
            <div className="relative">
              <button
                onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-base font-medium border-2 transition-all"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-secondary)'
                }}
              >
                <span className="flex items-center gap-2.5">
                  <ArrowUpDown size={16} />
                  {sortBy === 'updated' && '按更新时间'}
                  {sortBy === 'created' && '按创建时间'}
                  {sortBy === 'title' && '按标题'}
                  {sortBy === 'starred' && '按收藏'}
                </span>
                <ChevronDown size={16} className={`transition-transform ${sortDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {sortDropdownOpen && (
                <div
                  className="absolute top-full left-0 right-0 mt-2 py-2 rounded-2xl border-2 shadow-xl z-10 animate-scaleIn"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                >
                  {[
                    { key: 'updated', label: '按更新时间' },
                    { key: 'created', label: '按创建时间' },
                    { key: 'title', label: '按标题' },
                    { key: 'starred', label: '按收藏' }
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => { setSortBy(opt.key as SortOption); setSortDropdownOpen(false) }}
                      className="w-full px-4 py-3 text-left text-base font-medium transition-all hover:bg-[var(--accent-light)]"
                      style={{ color: sortBy === opt.key ? 'var(--accent)' : 'var(--text-primary)' }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 标签列表 */}
          {allTags.length > 0 && (
            <div className="px-3 pb-3">
              <div className="text-xs font-bold mb-2 flex items-center gap-1.5 tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>
                <Hash size={12} /> 标签
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterTag(null)}
                  className="px-4 py-1.5 rounded-full text-sm font-bold transition-all"
                  style={{
                    background: !filterTag ? 'var(--gradient-accent)' : 'var(--bg-card)',
                    color: !filterTag ? '#fff' : 'var(--text-secondary)',
                    boxShadow: !filterTag ? '0 3px 12px var(--accent-glow)' : 'none'
                  }}
                >
                  全部
                </button>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                    className="px-4 py-1.5 rounded-full text-sm font-bold transition-all hover:scale-105"
                    style={{
                      background: filterTag === tag ? 'var(--gradient-accent)' : 'var(--tag-bg)',
                      color: filterTag === tag ? '#fff' : 'var(--tag-text)',
                      boxShadow: filterTag === tag ? '0 3px 12px var(--accent-glow)' : 'none'
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 笔记列表 */}
          <div className="flex-1 overflow-y-auto px-2 py-1">
            {filteredNotes.map(note => (
              <NoteListItem
                key={note.id}
                note={note}
                isSelected={selectedId === note.id}
                onSelect={handleSelectNote}
              />
            ))}
            {filteredNotes.length === 0 && (
              <div className="empty-state py-12">
                <div className="text-4xl mb-3">{search || filterTag ? '🔍' : '🧁'}</div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                  {search || filterTag ? '没有找到匹配的笔记' : '还没有笔记，写一篇吧'}
                </p>
                {!search && !filterTag && (
                  <button
                    onClick={createNote}
                    className="mt-4 btn btn-primary text-sm"
                  >
                    <Plus size={16} /> 创建第一篇
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 底部操作 */}
          <div className="p-4 border-t space-y-3" style={{ borderColor: 'var(--border-color)' }}>
            <button
              onClick={createNote}
              disabled={loading}
              className="w-full py-3.5 rounded-2xl text-base font-bold flex items-center justify-center gap-2.5 transition-all btn-primary disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <Plus size={20} strokeWidth={3} /> 新建笔记
                </>
              )}
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all"
                style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '2px solid var(--border-color)' }}
                data-tooltip="导入 .md 文件"
              >
                <FileUp size={16} /> 导入
              </button>
              <button
                onClick={exportAll}
                className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all"
                style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '2px solid var(--border-color)' }}
                data-tooltip="导出全部备份"
              >
                <Download size={16} /> 导出
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ====== 主内容区 ====== */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* 顶栏 */}
        <header
          className="flex items-center justify-between px-6 py-4 border-b-2 transition-all"
          style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}
        >
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2.5 rounded-2xl transition-all hover:bg-[var(--accent-light)] hover:scale-110 active:scale-95"
              >
                <FolderOpen size={20} style={{ color: 'var(--text-secondary)' }} />
              </button>
            )}
            <span className="text-base font-bold" style={{ color: 'var(--text-secondary)' }}>
              {notes.length === 0 ? '🧁 暂无笔记' : `📖 共 ${notes.length} 篇笔记`}
              {filterTag && <span style={{ color: 'var(--accent)' }}> · #{filterTag}</span>}
              {search && <span> · 搜索 "{search}"</span>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* 保存状态 */}
            {selectedId && (
              <span className="text-sm font-bold px-4 py-2 rounded-xl mr-2 transition-all" style={{ 
                color: saveStatus === 'saving' ? 'var(--accent)' : 'var(--mint)',
                background: saveStatus === 'saving' ? 'var(--accent-light)' : 'var(--mint-light)'
              }}>
                {saveStatus === 'saving' && '💖 保存中...'}
                {saveStatus === 'saved' && '✨ 已保存'}
              </span>
            )}
            {/* 快捷键提示 */}
            <button
              onClick={() => setShowShortcuts(!showShortcuts)}
              className="btn-icon"
              data-tooltip="快捷键 (?)"
            >
              <Zap size={20} />
            </button>
            {/* 全屏 */}
            <button
              onClick={() => setFocusMode(!focusMode)}
              className="btn-icon"
              data-tooltip={focusMode ? '退出专注' : '专注模式'}
            >
              {focusMode ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            {/* 主题切换 */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-2xl transition-all hover:bg-[var(--accent-light)] hover:scale-110 active:scale-95"
            >
              {darkMode ? (
                <Sun size={20} style={{ color: 'var(--amber)' }} />
              ) : (
                <Moon size={20} style={{ color: 'var(--accent)' }} />
              )}
            </button>
          </div>
        </header>

        {/* 快捷键面板 */}
        {showShortcuts && (
          <div
            className="mx-6 mt-4 p-6 rounded-2xl border-2 animate-scaleIn card-glass"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div className="title-decorated text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              ⌨️ 快捷键
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Ctrl + N', '新建笔记'],
                ['Ctrl + S', '编辑当前笔记'],
                ['Ctrl + B', '切换侧边栏'],
                ['Esc', '退出编辑'],
                ['?', '显示此面板']
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center gap-3">
                  <kbd className="kbd">{key}</kbd>
                  <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 编辑/预览区 */}
        {selectedNote ? (
          <div
            className={`flex-1 overflow-y-auto p-8 transition-all ${focusMode ? 'max-w-5xl mx-auto' : ''}`}
          >
            {/* 标题 */}
            <div className="flex items-start gap-4 mb-6">
              {isEditing ? (
                <input
                  type="text"
                  value={selectedNote.title}
                  onChange={e => updateNote(selectedId!, { title: e.target.value })}
                  className="text-4xl font-black w-full outline-none bg-transparent tracking-tight"
                  style={{ color: 'var(--text-primary)' }}
                  placeholder="笔记标题"
                />
              ) : (
                <h1 className="text-5xl font-black tracking-tight leading-tight" style={{ color: 'var(--text-primary)' }}>{selectedNote.title || '未命名'}</h1>
              )}
              <button
                onClick={() => toggleStar(selectedId!)}
                className="p-3 rounded-2xl transition-all hover:bg-[var(--amber-light)] hover:scale-110 active:scale-95 flex-shrink-0"
              >
                <Star
                  size={24}
                  fill={selectedNote.starred ? 'var(--amber)' : 'none'}
                  color="var(--amber)"
                />
              </button>
            </div>

            {/* 元信息 */}
            <div className="inline-flex items-center gap-5 mb-6 text-base px-5 py-2.5 rounded-2xl" style={{ color: 'var(--text-muted)', background: 'var(--accent-light)' }}>
              <span className="flex items-center gap-2 font-medium">
                <Clock size={15} /> {formatDate(selectedNote.updatedAt)}
              </span>
              <span className="w-px h-5 opacity-30" style={{ background: 'var(--border-color)' }} />
              <span className="flex items-center gap-2 font-medium">
                <AlignLeft size={15} /> {countWords(selectedNote.content)} 字
              </span>
              <span className="w-px h-5 opacity-30" style={{ background: 'var(--border-color)' }} />
              <span className="flex items-center gap-2 font-medium">
                <Zap size={15} /> {getReadingTime(selectedNote.content)} 分钟阅读
              </span>
            </div>

            {/* 标签 */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              {selectedNote.tags.map(tag => (
                <span
                  key={tag}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-2xl text-sm font-bold"
                  style={{ background: 'var(--tag-bg)', color: 'var(--tag-text)' }}
                >
                  #{tag}
                  {isEditing && (
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-1 p-0.5 rounded-lg hover:bg-[var(--rose-light)] transition-all"
                    >
                      <X size={13} />
                    </button>
                  )}
                </span>
              ))}
              {isEditing && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTag()}
                    placeholder="添加标签"
                    className="px-4 py-2 rounded-2xl text-sm outline-none border-2 font-medium w-28 transition-all"
                    style={{
                      background: 'var(--bg-card)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <button onClick={addTag} className="p-2 rounded-xl hover:bg-[var(--mint-light)] transition-all hover:scale-110 active:scale-95">
                    <Check size={16} style={{ color: 'var(--mint)' }} />
                  </button>
                </div>
              )}
            </div>

            {/* 内容区 */}
            <div
              className="rounded-3xl border-2 p-8 min-h-[500px] transition-all shadow-lg"
              style={{
                background: 'var(--note-bg)',
                borderColor: 'var(--note-border)',
                boxShadow: 'var(--shadow-card)'
              }}
            >
              {isEditing ? (
                <textarea
                  ref={editRef}
                  value={selectedNote.content}
                  onChange={e => updateNote(selectedId!, { content: e.target.value })}
                  className="w-full min-h-[500px] outline-none resize-y text-base leading-relaxed bg-transparent"
                  style={{ color: 'var(--text-primary)', fontFamily: "'Noto Sans SC', monospace" }}
                  placeholder="在这里写 Markdown 笔记...

支持的功能：
- 标题 (# ## ###)
- 列表 (- 或 1.)
- 代码 (` 或 ```)
- 引用 (>)
- 链接和图片"
                />
              ) : (
                <div className="markdown-body">
                  {selectedNote.content ? (
                    <ReactMarkdown>{selectedNote.content}</ReactMarkdown>
                  ) : (
                    <p style={{ color: 'var(--text-muted)' }}>空笔记，点击编辑按钮开始写作 ✍️</p>
                  )}
                </div>
              )}
            </div>

            {/* 底部操作栏 */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t-2" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="btn btn-primary"
                >
                  {isEditing ? (
                    <><Eye size={18} /> 预览</>
                  ) : (
                    <><Edit3 size={18} /> 编辑</>
                  )}
                </button>
                <button
                  onClick={() => deleteNote(selectedId!)}
                  className="btn transition-all"
                  style={{ background: 'var(--rose-light)', color: 'var(--rose)', border: '2px solid transparent' }}
                >
                  <Trash2 size={18} /> 删除
                </button>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={exportMarkdown}
                  className="btn btn-secondary"
                >
                  <FileText size={18} /> .md
                </button>
                <button
                  onClick={exportHTML}
                  className="btn btn-secondary"
                >
                  <Download size={18} /> .html
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-fadeIn relative">
            <div className="relative">
              <div className="text-9xl mb-3 animate-wiggle" style={{ filter: 'drop-shadow(0 8px 32px var(--accent-glow))' }}>🧁</div>
              <div className="absolute -top-2 -right-2 text-2xl animate-bounce" style={{ animationDelay: '0.3s', filter: 'drop-shadow(0 0 10px var(--accent-glow))' }}>✨</div>
              <div className="absolute -bottom-2 -left-2 text-xl animate-float" style={{ animationDelay: '-1s' }}>🌸</div>
            </div>
            <div className="w-24 h-1 rounded-full" style={{ background: 'var(--gradient-macaron)', opacity: 0.4 }} />
            <div className="text-center">
              <p className="text-2xl font-bold" style={{ color: 'var(--text-secondary)' }}>
                挑选一颗甜蜜的笔记
              </p>
              <p className="text-base font-medium mt-2" style={{ color: 'var(--text-muted)' }}>
                或亲手烘焙一篇新的故事
              </p>
            </div>
            <button
              onClick={createNote}
              disabled={loading}
              className="btn btn-glow-macaron text-lg px-10 py-4 animate-glow"
            >
              {loading ? (
                <Loader2 size={22} className="animate-spin" />
              ) : (
                <><Plus size={22} strokeWidth={3} /> 开始创作</>
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

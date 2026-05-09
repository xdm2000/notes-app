'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Search, Plus, Tag, Trash2, Edit3, Eye, Moon, Sun,
  Download, FileText, X, Check, FolderOpen, Loader2
} from 'lucide-react'

// ========== 类型定义 ==========
interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

// ========== 主应用 ==========
export default function NotesApp() {
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
  const editRef = useRef<HTMLTextAreaElement>(null)

  // 初始化：从 API 加载笔记
  useEffect(() => {
    fetchNotes()
    setDarkMode(window.matchMedia('(prefer-color-scheme: dark)').matches)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [darkMode])

  // ========== API 调用 ==========
  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/notes')
      const data = await res.json()
      setNotes(data)
    } catch (err) {
      console.error('加载笔记失败:', err)
    }
  }, [])

  const createNoteAPI = useCallback(async (note: Partial<Note>) => {
    setLoading(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note)
      })
      const newNote = await res.json()
      setNotes(prev => [newNote, ...prev])
      setSelectedId(newNote.id)
      setIsEditing(true)
      setTimeout(() => editRef.current?.focus(), 100)
    } catch (err) {
      console.error('创建笔记失败:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const updateNoteAPI = useCallback(async (id: string, updates: Partial<Note>) => {
    try {
      await fetch(`/api/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      // 更新本地状态
      setNotes(prev => prev.map(n =>
        n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
      ))
    } catch (err) {
      console.error('更新笔记失败:', err)
    }
  }, [])

  const deleteNoteAPI = useCallback(async (id: string) => {
    try {
      await fetch(`/api/notes/${id}`, { method: 'DELETE' })
      setNotes(prev => prev.filter(n => n.id !== id))
      if (selectedId === id) setSelectedId(null)
    } catch (err) {
      console.error('删除笔记失败:', err)
    }
  }, [selectedId])

  // 所有标签
  const allTags = [...new Set(notes.flatMap(n => n.tags))].sort()

  // 筛选笔记
  const filteredNotes = notes.filter(n => {
    const matchSearch = !search ||
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase()) ||
      n.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
    const matchTag = !filterTag || n.tags.includes(filterTag)
    return matchSearch && matchTag
  }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

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
    // 立即更新本地状态（乐观更新）
    setNotes(prev => prev.map(n =>
      n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
    ))
    // 防抖：延迟发送 API（这里简化，直接发送）
    updateNoteAPI(id, updates)
  }, [updateNoteAPI])

  const deleteNote = useCallback((id: string) => {
    if (confirm('确定删除这条笔记吗？')) {
      deleteNoteAPI(id)
    }
  }, [deleteNoteAPI])

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

  // 导出
  const exportHTML = useCallback(() => {
    if (!selectedNote) return
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${selectedNote.title}</title>
<style>body{max-width:800px;margin:2em auto;padding:0 1em;font-family:system-ui;line-height:1.7}h1{color:#6366f1}code{background:#f1f5f9;padding:2px 6px;border-radius:4px}pre{background:#f1f5f9;padding:1em;border-radius:8px;overflow-x:auto}blockquote{border-left:3px solid #6366f1;padding-left:1em;color:#666}</style>
</head><body><h1>${selectedNote.title}</h1>${selectedNote.tags.map(t => `<span style="background:#ede9fe;color:#6d28d9;padding:2px 8px;border-radius:9999px;font-size:0.85em;margin-right:4px">${t}</span>`).join('')}<hr><div>${selectedNote.content}</div></body></html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${selectedNote.title}.html`; a.click()
    URL.revokeObjectURL(url)
  }, [selectedNote])

  const exportMarkdown = useCallback(() => {
    if (!selectedNote) return
    const md = `# ${selectedNote.title}\n\n${selectedNote.tags.map(t => `\`${t}\``).join(' ')}\n\n---\n\n${selectedNote.content}`
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${selectedNote.title}.md`; a.click()
    URL.revokeObjectURL(url)
  }, [selectedNote])

  const exportAll = useCallback(() => {
    const data = JSON.stringify(notes, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `notes-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    URL.revokeObjectURL(url)
  }, [notes])

  if (!mounted) return null

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* ====== 侧边栏 ====== */}
      {sidebarOpen && (
        <aside className="w-64 flex-shrink-0 flex flex-col border-r"
          style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-color)' }}>
          {/* 侧边栏头部 */}
          <div className="p-3 flex items-center justify-between border-b" style={{ borderColor: 'var(--border-color)' }}>
            <span className="font-bold text-lg" style={{ color: 'var(--accent)' }}>🗒️ 笔记</span>
            <button onClick={() => setSidebarOpen(false)} className="p-1 rounded hover:opacity-70">
              <X size={18} />
            </button>
          </div>

          {/* 搜索框 */}
          <div className="p-3">
            <div className="relative">
              <Search size={16} className="absolute left-2.5 top-2.5" style={{ color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="搜索笔记..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none border"
                style={{
                  background: 'var(--bg-primary)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
          </div>

          {/* 标签列表 */}
          {allTags.length > 0 && (
            <div className="px-3 pb-2">
              <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                <Tag size={12} className="inline mr-1" />标签
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setFilterTag(null)}
                  className="px-2 py-0.5 rounded-full text-xs transition-colors"
                  style={{
                    background: !filterTag ? 'var(--accent)' : 'var(--tag-bg)',
                    color: !filterTag ? '#fff' : 'var(--tag-text)'
                  }}>
                  全部
                </button>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                    className="px-2 py-0.5 rounded-full text-xs transition-colors"
                    style={{
                      background: filterTag === tag ? 'var(--accent)' : 'var(--tag-bg)',
                      color: filterTag === tag ? '#fff' : 'var(--tag-text)'
                    }}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 笔记列表 */}
          <div className="flex-1 overflow-y-auto px-2">
            {filteredNotes.map(note => (
              <button
                key={note.id}
                onClick={() => { setSelectedId(note.id); setIsEditing(false) }}
                className="w-full text-left p-2.5 rounded-lg mb-1 transition-colors"
                style={{
                  background: selectedId === note.id ? 'var(--accent)' : 'transparent',
                  color: selectedId === note.id ? '#fff' : 'var(--text-primary)'
                }}>
                <div className="font-medium text-sm truncate">{note.title || '无标题'}</div>
                <div className="text-xs mt-0.5 truncate" style={{
                  color: selectedId === note.id ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)'
                }}>
                  {note.content.slice(0, 50) || '空笔记'}
                </div>
                {note.tags.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {note.tags.slice(0, 3).map(t => (
                      <span key={t} className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          background: selectedId === note.id ? 'rgba(255,255,255,0.2)' : 'var(--tag-bg)',
                          color: selectedId === note.id ? '#fff' : 'var(--tag-text)'
                        }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
            {filteredNotes.length === 0 && (
              <div className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {search || filterTag ? '没有匹配的笔记' : '还没有笔记'}
              </div>
            )}
          </div>

          {/* 底部操作 */}
          <div className="p-3 border-t flex gap-2" style={{ borderColor: 'var(--border-color)' }}>
            <button onClick={createNote} disabled={loading}
              className="flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> 新建</>}
            </button>
            <button onClick={exportAll} title="导出全部备份"
              className="p-2 rounded-lg transition-colors"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
              <Download size={16} />
            </button>
          </div>
        </aside>
      )}

      {/* ====== 主内容区 ====== */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* 顶栏 */}
        <header className="flex items-center justify-between px-4 py-2 border-b"
          style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:opacity-70">
                <FolderOpen size={18} />
              </button>
            )}
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              共 {notes.length} 条笔记{filterTag ? ` · 筛选: ${filterTag}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg transition-colors" style={{ color: 'var(--text-secondary)' }}>
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {/* 编辑/预览区 */}
        {selectedNote ? (
          <div className="flex-1 overflow-y-auto p-6">
            {/* 标题 */}
            {isEditing ? (
              <input
                type="text"
                value={selectedNote.title}
                onChange={e => updateNote(selectedId!, { title: e.target.value })}
                className="text-2xl font-bold w-full outline-none mb-3 bg-transparent"
                style={{ color: 'var(--text-primary)' }}
                placeholder="笔记标题"
              />
            ) : (
              <h1 className="text-2xl font-bold mb-3">{selectedNote.title}</h1>
            )}

            {/* 标签 */}
            <div className="flex items-center gap-1.5 mb-4 flex-wrap">
              {selectedNote.tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                  style={{ background: 'var(--tag-bg)', color: 'var(--tag-text)' }}>
                  {tag}
                  {isEditing && (
                    <button onClick={() => removeTag(tag)} className="hover:opacity-50">
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))}
              {isEditing && (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTag()}
                    placeholder="添加标签"
                    className="px-2 py-0.5 rounded text-xs outline-none border w-20"
                    style={{
                      background: 'var(--bg-secondary)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <button onClick={addTag} className="p-0.5 rounded hover:opacity-50">
                    <Check size={14} style={{ color: 'var(--accent)' }} />
                  </button>
                </div>
              )}
            </div>

            {/* 内容 */}
            <div className="rounded-xl border p-4 min-h-[300px]"
              style={{ background: 'var(--note-bg)', borderColor: 'var(--note-border)' }}>
              {isEditing ? (
                <textarea
                  ref={editRef}
                  value={selectedNote.content}
                  onChange={e => updateNote(selectedId!, { content: e.target.value })}
                  className="w-full min-h-[400px] outline-none resize-y font-mono text-sm bg-transparent"
                  style={{ color: 'var(--text-primary)' }}
                  placeholder="在这里写 Markdown 笔记..."
                />
              ) : (
                <div className="prose">
                  {selectedNote.content ? (
                    <ReactMarkdown>{selectedNote.content}</ReactMarkdown>
                  ) : (
                    <p style={{ color: 'var(--text-secondary)' }}>空笔记，点击编辑按钮开始写作</p>
                  )}
                </div>
              )}
            </div>

            {/* 底部操作 */}
            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                  style={{ background: 'var(--accent)', color: '#fff' }}>
                  {isEditing ? <><Eye size={15} /> 预览</> : <><Edit3 size={15} /> 编辑</>}
                </button>
                <button onClick={() => deleteNote(selectedId!)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                  style={{ background: 'var(--bg-secondary)', color: '#ef4444' }}>
                  <Trash2 size={15} /> 删除
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={exportMarkdown}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                  <FileText size={15} /> .md
                </button>
                <button onClick={exportHTML}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                  <Download size={15} /> .html
                </button>
              </div>
            </div>

            {/* 时间 */}
            <div className="mt-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
              创建: {new Date(selectedNote.createdAt).toLocaleString('zh-CN')} ·
              更新: {new Date(selectedNote.updatedAt).toLocaleString('zh-CN')}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="text-6xl">📝</div>
            <p style={{ color: 'var(--text-secondary)' }}>
              选择一条笔记，或创建新的
            </p>
            <button onClick={createNote} disabled={loading}
              className="px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : <><Plus size={18} /> 新建笔记</>}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

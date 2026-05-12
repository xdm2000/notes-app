import { NextRequest, NextResponse } from 'next/server'
import { supabase, Note } from '@/lib/supabase'

export const runtime = 'edge'

// GET /api/notes - 获取所有笔记（按更新时间倒序）
export async function GET() {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 把数据库的 created_at/updated_at 转成 ISO 字符串
  const notes: Note[] = (data || []).map(row => ({
    id: row.id,
    title: row.title,
    content: row.content,
    tags: row.tags || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))

  return NextResponse.json(notes)
}

// POST /api/notes - 创建新笔记
export async function POST(request: NextRequest) {
  const body = await request.json()

  const newNote = {
    id: Date.now().toString(),
    title: body.title || '无标题',
    content: body.content || '',
    tags: body.tags || [],
  }

  const { data, error } = await supabase
    .from('notes')
    .insert(newNote)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    id: data.id,
    title: data.title,
    content: data.content,
    tags: data.tags || [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }, { status: 201 })
}

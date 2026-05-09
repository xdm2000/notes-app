import { NextRequest, NextResponse } from 'next/server'
import { supabase, Note } from '@/lib/supabase'

// GET /api/notes/:id - 获取单条笔记
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: '笔记不存在' }, { status: 404 })
  }

  const note: Note = {
    id: data.id,
    title: data.title,
    content: data.content,
    tags: data.tags || [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }

  return NextResponse.json(note)
}

// PUT /api/notes/:id - 更新笔记
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()

  const updates: Record<string, unknown> = {}
  if (body.title !== undefined) updates.title = body.title
  if (body.content !== undefined) updates.content = body.content
  if (body.tags !== undefined) updates.tags = body.tags

  const { data, error } = await supabase
    .from('notes')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: '笔记不存在' }, { status: 404 })
  }

  const note: Note = {
    id: data.id,
    title: data.title,
    content: data.content,
    tags: data.tags || [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }

  return NextResponse.json(note)
}

// DELETE /api/notes/:id - 删除笔记
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: '笔记不存在' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}

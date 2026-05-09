-- notes-app 建表 SQL
-- 在 Supabase Dashboard → SQL Editor 中执行

-- 1. 创建 notes 表
create table if not exists notes (
  id text primary key,
  title text not null default '无标题',
  content text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. 开启 RLS（Row Level Security）
alter table notes enable row level security;

-- 3. 允许所有 anon 用户的读写（笔记应用，无需鉴权）
create policy "Allow all for anon" on notes
  for all
  using (true)
  with check (true);

-- 4. 自动更新 updated_at 的触发器
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_note_update
  before update on notes
  for each row execute procedure update_updated_at();

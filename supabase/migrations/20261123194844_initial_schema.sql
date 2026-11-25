create schema if not exists extensions;
create extension if not exists vector with schema extensions;
grant usage on schema extensions to authenticated, service_role;

create schema private;
revoke all on schema private from public, anon, authenticated;

create table public.accounts (
  clerk_user_id text primary key,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references public.accounts (clerk_user_id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  public_key text not null unique check (public_key ~ '^pk_[A-Za-z0-9_-]+$'),
  messages_used integer not null default 0 check (messages_used >= 0),
  period_start date not null default date_trunc('month', now() at time zone 'UTC')::date,
  created_at timestamptz not null default now()
);
create index projects_owner_id_idx on public.projects (owner_id);

create table public.widget_configs (
  project_id uuid primary key references public.projects (id) on delete cascade,
  button_color text not null check (button_color ~ '^#[0-9A-Fa-f]{6}$'),
  position text not null default 'bottom-right'
    check (position in ('top-left', 'top-right', 'bottom-left', 'bottom-right')),
  label text not null check (btrim(label) <> ''),
  animation text not null default 'fade' check (animation in ('fade', 'slide', 'scale')),
  header_text text not null check (btrim(header_text) <> ''),
  show_badge boolean not null default true
);

create table public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  type text not null check (type in ('text', 'pdf', 'md', 'txt')),
  storage_key text,
  status text not null check (status in ('uploading', 'processing', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  unique (project_id, id),
  check ((type = 'text') = (storage_key is null))
);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  source_id uuid not null,
  content text not null,
  embedding extensions.vector(1536) not null,
  foreign key (project_id, source_id)
    references public.knowledge_sources (project_id, id) on delete cascade
);
create index knowledge_chunks_project_source_idx on public.knowledge_chunks (project_id, source_id);
create index knowledge_chunks_embedding_hnsw_idx on public.knowledge_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  visitor_id text not null,
  created_at timestamptz not null default now()
);
create index conversations_project_created_idx on public.conversations (project_id, created_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('visitor', 'bot')),
  body text not null,
  created_at timestamptz not null default now()
);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at);

create function private.owned_project_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.projects where owner_id = (select auth.jwt() ->> 'sub');
$$;

create function private.owned_conversation_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select conversations.id
  from public.conversations
  join public.projects on projects.id = conversations.project_id
  where projects.owner_id = (select auth.jwt() ->> 'sub');
$$;

revoke all on function private.owned_project_ids(), private.owned_conversation_ids()
  from public, anon, authenticated, service_role;
grant execute on function private.owned_project_ids(), private.owned_conversation_ids()
  to authenticated;

alter table public.accounts enable row level security;
alter table public.projects enable row level security;
alter table public.widget_configs enable row level security;
alter table public.knowledge_sources enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy accounts_select_own on public.accounts for select to authenticated
  using (clerk_user_id = (select auth.jwt() ->> 'sub'));
create policy projects_select_own on public.projects for select to authenticated
  using (id in (select private.owned_project_ids()));
create policy projects_rename_own on public.projects for update to authenticated
  using (id in (select private.owned_project_ids()))
  with check (owner_id = (select auth.jwt() ->> 'sub'));
create policy projects_delete_own on public.projects for delete to authenticated
  using (id in (select private.owned_project_ids()));
create policy widget_configs_select_own on public.widget_configs for select to authenticated
  using (project_id in (select private.owned_project_ids()));
create policy knowledge_sources_select_own on public.knowledge_sources for select to authenticated
  using (project_id in (select private.owned_project_ids()));
create policy knowledge_chunks_select_own on public.knowledge_chunks for select to authenticated
  using (project_id in (select private.owned_project_ids()));
create policy conversations_select_own on public.conversations for select to authenticated
  using (project_id in (select private.owned_project_ids()));
create policy messages_select_own on public.messages for select to authenticated
  using (conversation_id in (select private.owned_conversation_ids()));

-- Replace hosted default grants explicitly, including TRUNCATE, which bypasses RLS.
revoke all on public.accounts, public.projects, public.widget_configs,
  public.knowledge_sources, public.knowledge_chunks, public.conversations, public.messages
  from public, anon, authenticated, service_role;
grant select on public.accounts, public.projects, public.widget_configs,
  public.knowledge_sources, public.knowledge_chunks, public.conversations, public.messages
  to authenticated;
grant update (name), delete on public.projects to authenticated;
grant select, insert, update, delete on public.accounts, public.projects, public.widget_configs,
  public.knowledge_sources, public.knowledge_chunks, public.conversations, public.messages
  to service_role;

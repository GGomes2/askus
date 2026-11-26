create function public.create_project(p_owner_id text, p_name text, p_project_limit integer)
returns public.projects
language plpgsql security invoker set search_path = ''
as $$
declare
  new_project public.projects;
begin
  -- Lock the account even when it has no projects yet.
  perform 1 from public.accounts where clerk_user_id = p_owner_id for no key update;
  if not found then
    raise no_data_found using message = 'Account not found';
  end if;

  if p_project_limit is null or (
    select count(*) from public.projects where owner_id = p_owner_id
  ) >= p_project_limit then
    raise exception 'Project limit reached';
  end if;

  insert into public.projects (owner_id, name, public_key)
  values (p_owner_id, p_name, 'pk_' || replace(gen_random_uuid()::text, '-', ''))
  returning * into new_project;

  insert into public.widget_configs (project_id, button_color, label, header_text)
  values (new_project.id, '#000000', 'Chat', 'How can we help?');

  return new_project;
end;
$$;

create function public.reserve_knowledge_source(
  p_project_id uuid, p_title text, p_type text, p_source_limit integer
)
returns public.knowledge_sources
language plpgsql security invoker set search_path = ''
as $$
declare
  new_source_id uuid := gen_random_uuid();
  new_source public.knowledge_sources;
begin
  perform 1 from public.projects where id = p_project_id for no key update;
  if not found then
    raise no_data_found using message = 'Project not found';
  end if;

  if p_source_limit is null or (
    select count(*) from public.knowledge_sources where project_id = p_project_id
  ) >= p_source_limit then
    raise exception 'Knowledge source limit reached';
  end if;

  insert into public.knowledge_sources (id, project_id, title, type, storage_key, status)
  values (
    new_source_id, p_project_id, p_title, p_type,
    case when p_type <> 'text' then p_project_id || '/' || new_source_id || '.' || p_type end,
    case when p_type = 'text' then 'processing' else 'uploading' end
  )
  returning * into new_source;

  return new_source;
end;
$$;

create function public.consume_message(
  p_project_id uuid, p_message_limit integer, p_conversation_id uuid default null
)
returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare
  current_month date;
  current_usage integer;
  stored_month date;
begin
  select messages_used, period_start into current_usage, stored_month
  from public.projects where id = p_project_id for no key update;
  if not found then
    raise no_data_found using message = 'Project not found';
  end if;

  if p_conversation_id is not null then
    perform 1 from public.conversations
    where id = p_conversation_id and project_id = p_project_id for key share;
    if not found then
      raise no_data_found using message = 'Conversation not found';
    end if;
  end if;

  current_month := date_trunc('month', clock_timestamp() at time zone 'UTC')::date;
  if stored_month <> current_month then
    current_usage := 0;
  end if;

  if p_message_limit is null or current_usage >= p_message_limit then
    return false;
  end if;

  update public.projects
  set messages_used = current_usage + 1, period_start = current_month
  where id = p_project_id;
  return true;
end;
$$;

create function public.save_chat_turn(
  p_project_id uuid, p_visitor_id text, p_message text, p_reply text,
  p_conversation_id uuid default null
)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  target_conversation_id uuid;
  turn_time timestamptz;
begin
  if p_conversation_id is null then
    insert into public.conversations (project_id, visitor_id)
    values (p_project_id, p_visitor_id)
    returning id into target_conversation_id;
  else
    select id into target_conversation_id
    from public.conversations
    where id = p_conversation_id and project_id = p_project_id
    for no key update;
    if not found then
      raise no_data_found using message = 'Conversation not found';
    end if;
  end if;

  -- Preserve visitor/bot order even when concurrent turns arrive together.
  select greatest(clock_timestamp(), max(created_at) + interval '1 microsecond')
  into turn_time
  from public.messages where conversation_id = target_conversation_id;

  insert into public.messages (conversation_id, role, body, created_at)
  values
    (target_conversation_id, 'visitor', p_message, turn_time),
    (target_conversation_id, 'bot', p_reply, turn_time + interval '1 microsecond');

  return target_conversation_id;
end;
$$;

create function public.match_chunks(p_project_id uuid, p_embedding extensions.vector)
returns table (id uuid, source_id uuid, content text, similarity double precision)
language sql stable security invoker set search_path = ''
as $$
  -- Rank the scoped set exactly. An approximate index scan can discard valid
  -- neighbors when most of the index belongs to other projects or unready sources.
  with candidates as materialized (
    select c.id, c.source_id, c.content,
      c.embedding operator(extensions.<=>) p_embedding as distance
    from public.knowledge_chunks c
    join public.knowledge_sources s on s.project_id = c.project_id and s.id = c.source_id
    where c.project_id = p_project_id and s.status = 'ready'
  )
  select id, source_id, content, 1 - distance as similarity
  from candidates
  where distance < 'Infinity'::double precision
  order by distance, id
  limit 5;
$$;

create function public.owner_activity()
returns table (
  project_id uuid, messages_used integer, knowledge_sources bigint, conversations bigint
)
language sql stable security invoker set search_path = ''
as $$
  select p.id,
    case when p.period_start = date_trunc('month', now() at time zone 'UTC')::date
      then p.messages_used else 0 end,
    (select count(*) from public.knowledge_sources s where s.project_id = p.id),
    (select count(*) from public.conversations c where c.project_id = p.id)
  from public.projects p;
$$;

revoke all on function public.create_project(text, text, integer),
  public.reserve_knowledge_source(uuid, text, text, integer),
  public.consume_message(uuid, integer, uuid),
  public.save_chat_turn(uuid, text, text, text, uuid),
  public.match_chunks(uuid, extensions.vector),
  public.owner_activity()
  from public, anon, authenticated, service_role;

grant execute on function public.create_project(text, text, integer),
  public.reserve_knowledge_source(uuid, text, text, integer),
  public.consume_message(uuid, integer, uuid),
  public.save_chat_turn(uuid, text, text, text, uuid),
  public.match_chunks(uuid, extensions.vector)
  to service_role;

grant execute on function public.owner_activity() to authenticated, service_role;

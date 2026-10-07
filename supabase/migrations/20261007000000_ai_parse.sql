-- Backend tables for the parse-transaction Edge Function.
-- Neither table stores notification text: the cache key is a SHA-256 of the normalized text and
-- the value is the parsed result only.

create table if not exists public.ai_parse_cache (
  text_hash text primary key,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_usage (
  install_id text not null,
  day date not null default current_date,
  calls integer not null default 0,
  primary key (install_id, day)
);

-- Only the Edge Function (service role) touches these tables.
alter table public.ai_parse_cache enable row level security;
alter table public.ai_usage enable row level security;

-- Atomic per-install daily counter; returns the count after this call.
create or replace function public.increment_ai_usage(p_install_id text)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.ai_usage (install_id, day, calls)
  values (p_install_id, current_date, 1)
  on conflict (install_id, day) do update set calls = public.ai_usage.calls + 1
  returning calls;
$$;

revoke all on function public.increment_ai_usage(text) from public, anon, authenticated;

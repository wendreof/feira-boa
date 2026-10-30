-- Vinculo da conta com o bot do Telegram para envio de alertas.
-- O site cria um token curto (start=...); o job telegram-links.mjs troca o token
-- pelo chat_id usando a service role. O chat_id nunca e escrito pelo navegador.

create table if not exists public.telegram_link_tokens (
  token text primary key check (char_length(token) between 16 and 64),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);

create table if not exists public.telegram_links (
  user_id uuid primary key references auth.users (id) on delete cascade,
  chat_id bigint not null unique,
  linked_at timestamptz not null default now()
);

alter table public.telegram_link_tokens enable row level security;
alter table public.telegram_links enable row level security;

revoke all on public.telegram_link_tokens, public.telegram_links from anon, authenticated;

drop policy if exists "Users create their telegram link tokens" on public.telegram_link_tokens;
create policy "Users create their telegram link tokens" on public.telegram_link_tokens
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete their telegram link tokens" on public.telegram_link_tokens;
create policy "Users delete their telegram link tokens" on public.telegram_link_tokens
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users read their telegram link" on public.telegram_links;
create policy "Users read their telegram link" on public.telegram_links
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users remove their telegram link" on public.telegram_links;
create policy "Users remove their telegram link" on public.telegram_links
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant insert, delete on public.telegram_link_tokens to authenticated;
grant select, delete on public.telegram_links to authenticated;
-- Insercoes em telegram_links so pela service role (job de sincronizacao).

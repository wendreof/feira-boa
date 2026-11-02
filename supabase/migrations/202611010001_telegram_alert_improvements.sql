-- Canais no histórico, estado de entrega Telegram, TTL de vínculo e ledger de execução.

alter table public.notification_log
  add column if not exists channel text not null default 'telegram'
    check (channel in ('telegram', 'push', 'email'));

alter table public.notification_log
  drop constraint if exists notification_log_user_id_offer_id_key;

alter table public.notification_log
  add constraint notification_log_user_offer_channel_key
  unique (user_id, offer_id, channel);

alter table public.telegram_links
  add column if not exists delivery_blocked boolean not null default false;

alter table public.telegram_links
  add column if not exists delivery_blocked_at timestamptz;

alter table public.telegram_link_tokens
  alter column expires_at set default (now() + interval '24 hours');

create table if not exists public.alert_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('ok', 'failed', 'partial')),
  details jsonb not null default '{}'::jsonb
);

alter table public.alert_runs enable row level security;
revoke all on public.alert_runs from anon, authenticated;

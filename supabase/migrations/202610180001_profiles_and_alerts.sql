-- Feira Boa account preferences and opt-in alert storage.
-- Every user-owned table is protected by RLS; service-role access belongs only
-- in trusted scheduled jobs, never in the browser.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  timezone text not null default 'America/Sao_Paulo',
  notifications_paused boolean not null default false,
  preferences jsonb not null default '{"favoriteStores":[],"favoriteProducts":[]}'::jsonb,
  constraint profiles_preferences_object check (jsonb_typeof(preferences) = 'object')
);

create table if not exists public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  store text,
  product text,
  product_type text,
  target_price numeric(10, 2) not null check (target_price > 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint alert_rules_match_target check (
    nullif(trim(product), '') is not null or nullif(trim(product_type), '') is not null
  )
);

create index if not exists alert_rules_enabled_user_idx
  on public.alert_rules (user_id) where enabled;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists public.notification_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  offer_id text not null,
  sent_at timestamptz not null default now(),
  result text not null check (result in ('sent', 'failed')),
  error_code text,
  unique (user_id, offer_id)
);

alter table public.profiles enable row level security;
alter table public.alert_rules enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_log enable row level security;

revoke all on public.profiles, public.alert_rules, public.push_subscriptions, public.notification_log
  from anon, authenticated;

drop policy if exists "Users manage their profile" on public.profiles;
create policy "Users manage their profile" on public.profiles
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their alert rules" on public.alert_rules;
create policy "Users manage their alert rules" on public.alert_rules
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their push subscriptions" on public.push_subscriptions;
create policy "Users manage their push subscriptions" on public.push_subscriptions
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users read their notification history" on public.notification_log;
create policy "Users read their notification history" on public.notification_log
  for select to authenticated using ((select auth.uid()) = user_id);

-- Only the trusted service role can write notification delivery results.
revoke insert, update, delete on public.notification_log from anon, authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.alert_rules to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select on public.notification_log to authenticated;

-- Keep a minimal profile row in sync with Supabase Auth. Account removal
-- cascades through the user-owned tables above.
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

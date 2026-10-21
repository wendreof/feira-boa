-- Admin access for the read-only operations view.
--
-- Access is granted by an explicit allowlist table, never by a client-side
-- flag, a query parameter, or editable user metadata. The dashboard only
-- exposes aggregate operational data: no emails, no saved preferences, no
-- push endpoints, and no notification payloads.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;
grant select (user_id) on public.admin_users to authenticated;

drop policy if exists "Users read their admin access" on public.admin_users;
create policy "Users read their admin access"
  on public.admin_users for select to authenticated
  using ((select auth.uid()) = user_id);

-- Helper used by the dashboard and by the aggregate stats function.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Aggregate alert-delivery outcomes for the operations view. Rows are
-- counts only: no user identifiers, offers, endpoints, or error payloads.
create or replace function public.get_admin_alert_stats()
returns table (
  window_days integer,
  sent bigint,
  failed bigint,
  users_with_alerts bigint,
  rules_total bigint,
  rules_enabled bigint,
  subscriptions_total bigint,
  last_sent_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Acesso restrito a administradores.';
  end if;

  return query
  select
    30::integer,
    count(*) filter (where log.result = 'sent'),
    count(*) filter (where log.result <> 'sent'),
    (select count(distinct user_id) from public.notification_log where sent_at > now() - interval '30 days'),
    (select count(*) from public.alert_rules),
    (select count(*) from public.alert_rules where enabled),
    (select count(*) from public.push_subscriptions),
    max(log.sent_at)
  from public.notification_log as log
  where log.sent_at > now() - interval '30 days';
end;
$$;

revoke all on function public.get_admin_alert_stats() from public;
grant execute on function public.get_admin_alert_stats() to authenticated;

-- Grant admin access to a trusted maintainer account:
--
--   insert into public.admin_users (user_id)
--   select id from auth.users where email = 'voce@exemplo.com';
--
-- Revoke it with:
--
--   delete from public.admin_users where user_id = (
--     select id from auth.users where email = 'voce@exemplo.com'
--   );

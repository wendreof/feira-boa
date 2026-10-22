-- Aggregate account population for the operations view.
--
-- Only counts are returned: no emails, no identities, no push endpoints.
-- The function is security definer so it can read auth.users, and it refuses
-- to run for anyone outside the admin allowlist.

create or replace function public.get_admin_account_stats()
returns table (
  total_accounts bigint,
  google_accounts bigint,
  email_accounts bigint,
  accounts_with_alerts bigint,
  accounts_with_push bigint,
  new_accounts_7d bigint,
  new_accounts_30d bigint
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
    (select count(*) from auth.users),
    (select count(*) from auth.users where coalesce(raw_app_meta_data ->> 'provider', 'email') = 'google'),
    (select count(*) from auth.users where coalesce(raw_app_meta_data ->> 'provider', 'email') <> 'google'),
    (select count(distinct user_id) from public.alert_rules),
    (select count(distinct user_id) from public.push_subscriptions),
    (select count(*) from auth.users where created_at > now() - interval '7 days'),
    (select count(*) from auth.users where created_at > now() - interval '30 days');
end;
$$;

revoke all on function public.get_admin_account_stats() from public;
grant execute on function public.get_admin_account_stats() to authenticated;

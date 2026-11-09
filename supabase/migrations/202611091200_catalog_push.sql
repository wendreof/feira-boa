-- Daily catalog push for anonymous devices and logged-in push endpoints.

create table if not exists public.anonymous_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now(),
  last_catalog_push_at timestamptz
);

alter table public.push_subscriptions
  add column if not exists last_catalog_push_at timestamptz;

create table if not exists public.catalog_push_state (
  id smallint primary key default 1 check (id = 1),
  feed_fingerprint text not null default '',
  feed_updated_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.catalog_push_state (id, feed_fingerprint)
values (1, '')
on conflict (id) do nothing;

alter table public.anonymous_push_subscriptions enable row level security;
revoke all on public.anonymous_push_subscriptions, public.catalog_push_state
  from anon, authenticated;

create or replace function public.register_anonymous_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_endpoint is null or length(trim(p_endpoint)) < 8 or p_endpoint !~ '^https://' then
    raise exception 'invalid push endpoint';
  end if;
  if p_p256dh is null or length(p_p256dh) < 20 then
    raise exception 'invalid p256dh key';
  end if;
  if p_auth_key is null or length(p_auth_key) < 10 then
    raise exception 'invalid auth key';
  end if;

  insert into public.anonymous_push_subscriptions (endpoint, p256dh, auth_key)
  values (trim(p_endpoint), trim(p_p256dh), trim(p_auth_key))
  on conflict (endpoint) do update set
    p256dh = excluded.p256dh,
    auth_key = excluded.auth_key;
end;
$$;

create or replace function public.unregister_anonymous_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_endpoint is null or length(trim(p_endpoint)) = 0 then
    return;
  end if;
  delete from public.anonymous_push_subscriptions where endpoint = trim(p_endpoint);
end;
$$;

revoke all on function public.register_anonymous_push_subscription(text, text, text) from public;
revoke all on function public.unregister_anonymous_push_subscription(text) from public;
grant execute on function public.register_anonymous_push_subscription(text, text, text) to anon, authenticated;
grant execute on function public.unregister_anonymous_push_subscription(text) to anon, authenticated;

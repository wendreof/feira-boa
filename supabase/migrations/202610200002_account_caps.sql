-- Small server-side caps for account-owned rows. These limits keep a single
-- compromised or runaway client from filling the alert queue.

create or replace function public.enforce_alert_rule_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.alert_rules where user_id = new.user_id) >= 20 then
    raise exception 'Cada conta pode ter no máximo 20 alertas de preço.';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_alert_rule_limit() from public;

drop trigger if exists enforce_alert_rule_limit_before_insert on public.alert_rules;
create trigger enforce_alert_rule_limit_before_insert
  before insert on public.alert_rules
  for each row execute function public.enforce_alert_rule_limit();

create or replace function public.enforce_push_subscription_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.push_subscriptions
    where endpoint = new.endpoint and user_id = new.user_id
  ) then
    return new;
  end if;

  if (select count(*) from public.push_subscriptions where user_id = new.user_id) >= 10 then
    raise exception 'Cada conta pode ter no máximo 10 dispositivos com notificações.';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_push_subscription_limit() from public;

drop trigger if exists enforce_push_subscription_limit_before_insert on public.push_subscriptions;
create trigger enforce_push_subscription_limit_before_insert
  before insert on public.push_subscriptions
  for each row execute function public.enforce_push_subscription_limit();

alter table public.offer_reactions
  drop constraint if exists offer_reactions_offer_id_shape;

alter table public.offer_reactions
  add constraint offer_reactions_offer_id_shape
  check (offer_id ~ '^[a-z0-9][a-z0-9-]{2,199}$');

create index if not exists offer_reactions_offer_id_idx
  on public.offer_reactions (offer_id);

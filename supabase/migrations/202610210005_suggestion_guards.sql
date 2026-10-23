-- Server-side guards for the suggestion inbox.
--
-- The browser used to own the abuse checks: it looked at a hidden honeypot
-- field and kept a 60-second cooldown in localStorage. A script can ignore
-- both, so the database is now the only authority. Every insert must come
-- from a signed-in account, must carry an empty honeypot value, must respect
-- the 60-second cooldown and the 3-per-day cap, and rows older than 180 days
-- are pruned on the way in.
--
-- Every limit keys off auth.uid(), never off a client-supplied id, and the
-- insert policy from 202610210003 already forces user_id = auth.uid().
--
-- The guards are separate BEFORE INSERT triggers. PostgreSQL runs them in
-- name order, so the numeric prefixes keep the cheap checks (honeypot) ahead
-- of the counting ones (cooldown, daily cap). The messages are the ones the
-- browser shows to the reader, so they stay in pt-BR and stay distinct.

-- The honeypot travels with the insert so the server can reject the row.
alter table public.suggestions add column if not exists honeypot text not null default '';

-- Only signed-in accounts may insert, and only the columns the client sends.
revoke insert on public.suggestions from anon;
revoke insert (category, message, user_id, honeypot) on public.suggestions from anon;
grant insert (category, message, user_id, honeypot) on public.suggestions to authenticated;

-- Honeypot: a filled field means an automated client, so the row is refused.
create or replace function public.enforce_suggestion_honeypot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(pg_catalog.btrim(new.honeypot), '') is not null then
    raise exception 'Não foi possível registrar a sugestão.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_suggestion_honeypot() from public;

drop trigger if exists guard_1_honeypot_before_insert on public.suggestions;
create trigger guard_1_honeypot_before_insert
  before insert on public.suggestions
  for each row execute function public.enforce_suggestion_honeypot();

-- Cooldown: one suggestion per account every 60 seconds.
create or replace function public.enforce_suggestion_cooldown()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  account uuid := (select auth.uid());
begin
  if account is null then
    raise exception 'Entre na sua conta para enviar uma sugestão.';
  end if;

  if exists (
    select 1 from public.suggestions
    where user_id = account and created_at > now() - interval '60 seconds'
  ) then
    raise exception 'Aguarde 60 segundos antes de enviar outra sugestão.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_suggestion_cooldown() from public;

drop trigger if exists guard_2_cooldown_before_insert on public.suggestions;
create trigger guard_2_cooldown_before_insert
  before insert on public.suggestions
  for each row execute function public.enforce_suggestion_cooldown();

-- Daily cap: 3 suggestions per account per day, counted from auth.uid().
-- The limit function from 202610210003 keyed off the client-supplied
-- user_id, so it is replaced by this one that trusts auth.uid() only.
drop trigger if exists enforce_suggestion_limit_before_insert on public.suggestions;
drop function if exists public.enforce_suggestion_limit();

create or replace function public.enforce_suggestion_daily_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  account uuid := (select auth.uid());
  total integer;
begin
  if account is null then
    raise exception 'Entre na sua conta para enviar uma sugestão.';
  end if;

  select count(*) into total
  from public.suggestions
  where user_id = account and created_at > now() - interval '1 day';

  if total >= 3 then
    raise exception 'Cada conta pode enviar no máximo 3 sugestões por dia.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_suggestion_daily_limit() from public;

drop trigger if exists guard_3_daily_limit_before_insert on public.suggestions;
create trigger guard_3_daily_limit_before_insert
  before insert on public.suggestions
  for each row execute function public.enforce_suggestion_daily_limit();

-- Retention: keep 180 days of suggestions, pruned whenever a new one arrives.
create or replace function public.prune_old_suggestions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.suggestions
  where created_at < now() - interval '180 days';
  return new;
end;
$$;

revoke all on function public.prune_old_suggestions() from public;

drop trigger if exists prune_old_suggestions_before_insert on public.suggestions;
create trigger prune_old_suggestions_before_insert
  before insert on public.suggestions
  for each row execute function public.prune_old_suggestions();

comment on function public.enforce_suggestion_honeypot() is
  'Rejects suggestions whose honeypot field is filled, so bots cannot post.';

comment on function public.enforce_suggestion_daily_limit() is
  'Allows at most 3 suggestions per account per day.';

comment on function public.enforce_suggestion_cooldown() is
  'Allows at most one suggestion per account every 60 seconds.';

comment on function public.prune_old_suggestions() is
  'Deletes suggestions older than 180 days whenever a new suggestion is inserted.';

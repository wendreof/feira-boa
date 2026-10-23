-- Suggestions require a signed-in account and are limited per account.
--
-- Anonymous suggestions stay in the table (user_id is nullable for legacy
-- rows), but new inserts must carry the caller's own account. The per-account
-- limit replaces the client-only cooldown as the real abuse guard: a bot can
-- ignore the browser, but it cannot create accounts for free.

alter table public.suggestions add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists suggestions_user_id_idx
  on public.suggestions (user_id, created_at desc);

-- Only the account that owns a row can insert it.
revoke insert on public.suggestions from anon;
grant insert (category, message, user_id) on public.suggestions to authenticated;

drop policy if exists "Anyone can submit suggestions" on public.suggestions;
create policy "Signed-in users submit suggestions"
  on public.suggestions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Limit: 3 suggestions per account per day.
create or replace function public.enforce_suggestion_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null then
    raise exception 'Entre na sua conta para enviar uma sugestão.';
  end if;

  if (select count(*) from public.suggestions
      where user_id = new.user_id and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Cada conta pode enviar no máximo 3 sugestões por dia.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_suggestion_limit() from public;

drop trigger if exists enforce_suggestion_limit_before_insert on public.suggestions;
create trigger enforce_suggestion_limit_before_insert
  before insert on public.suggestions
  for each row execute function public.enforce_suggestion_limit();

comment on function public.enforce_suggestion_limit() is
  'Requires a signed-in account and allows at most 3 suggestions per account per day.';

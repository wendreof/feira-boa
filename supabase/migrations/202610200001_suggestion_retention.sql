-- Keep the public suggestion inbox small without adding a CAPTCHA dependency.
-- The client already uses a honeypot and a 60-second cooldown. This migration
-- adds the server-side retention guard so old rows are pruned on new inserts.

create index if not exists suggestions_created_at_idx
  on public.suggestions (created_at desc);

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

comment on function public.prune_old_suggestions() is
  'Deletes suggestions older than 180 days whenever a new suggestion is inserted.';

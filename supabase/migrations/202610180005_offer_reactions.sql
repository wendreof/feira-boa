-- Store one like/dislike per signed-in user and offer. Public users can only
-- read aggregate counts through the RPC, never individual user reactions.
create table if not exists public.offer_reactions (
  user_id uuid not null references auth.users (id) on delete cascade,
  offer_id text not null,
  reaction text not null check (reaction in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, offer_id)
);

alter table public.offer_reactions enable row level security;
revoke all on public.offer_reactions from anon, authenticated;
grant select (user_id, offer_id, reaction) on public.offer_reactions to authenticated;
grant insert (user_id, offer_id, reaction) on public.offer_reactions to authenticated;
grant update (reaction) on public.offer_reactions to authenticated;

drop policy if exists "Users read their offer reactions" on public.offer_reactions;
create policy "Users read their offer reactions"
  on public.offer_reactions for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users add their offer reactions" on public.offer_reactions;
create policy "Users add their offer reactions"
  on public.offer_reactions for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their offer reactions" on public.offer_reactions;
create policy "Users update their offer reactions"
  on public.offer_reactions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.get_offer_reaction_counts()
returns table (offer_id text, likes bigint, dislikes bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    reactions.offer_id,
    count(*) filter (where reactions.reaction = 'like') as likes,
    count(*) filter (where reactions.reaction = 'dislike') as dislikes
  from public.offer_reactions as reactions
  group by reactions.offer_id;
$$;

revoke all on function public.get_offer_reaction_counts() from public;
grant execute on function public.get_offer_reaction_counts() to anon, authenticated;

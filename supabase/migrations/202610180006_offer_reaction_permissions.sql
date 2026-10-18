-- Table privileges are required by the upsert/delete REST operations. RLS
-- policies below continue to restrict each operation to the signed-in owner.
grant select, insert, update, delete on table public.offer_reactions to authenticated;
revoke all on table public.offer_reactions from anon;

drop policy if exists "Users delete their offer reactions" on public.offer_reactions;
create policy "Users delete their offer reactions"
  on public.offer_reactions for delete to authenticated
  using ((select auth.uid()) = user_id);
-- DELETE em telegram_link_tokens filtra por user_id e precisa de SELECT
-- (permissão e política) para localizar as linhas. Sem isso: "permission denied".

grant select on public.telegram_link_tokens to authenticated;

drop policy if exists "Users read their telegram link tokens" on public.telegram_link_tokens;
create policy "Users read their telegram link tokens" on public.telegram_link_tokens
  for select to authenticated
  using ((select auth.uid()) = user_id);

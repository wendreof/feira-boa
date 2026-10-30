-- Avaliacao de lojas (1 a 5 estrelas) por conta.
-- Cada conta tem uma nota por loja. A media e a quantidade sao publicas via
-- store_rating_summary(), sem expor quem votou.

create table if not exists public.store_ratings (
  user_id uuid not null references auth.users (id) on delete cascade,
  store_id text not null check (char_length(store_id) between 1 and 64),
  rating smallint not null check (rating between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (user_id, store_id)
);

alter table public.store_ratings enable row level security;

revoke all on public.store_ratings from anon, authenticated;

drop policy if exists "Users manage their store ratings" on public.store_ratings;
create policy "Users manage their store ratings" on public.store_ratings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.store_ratings to authenticated;

create or replace function public.store_rating_summary()
returns table (store_id text, average numeric, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select sr.store_id, round(avg(sr.rating)::numeric, 2), count(*)
  from public.store_ratings sr
  group by sr.store_id;
$$;

revoke all on function public.store_rating_summary() from public;
grant execute on function public.store_rating_summary() to anon, authenticated;

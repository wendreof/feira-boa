-- Public can submit feedback, but only trusted service-role workflows can read it.
create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('idea', 'bug', 'content', 'other')),
  message text not null check (char_length(btrim(message)) between 10 and 2000),
  status text not null default 'new' check (status in ('new', 'reviewed', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.suggestions enable row level security;
revoke all on public.suggestions from anon, authenticated;
grant insert (category, message) on public.suggestions to anon, authenticated;

drop policy if exists "Anyone can submit suggestions" on public.suggestions;
create policy "Anyone can submit suggestions"
  on public.suggestions
  for insert
  to anon, authenticated
  with check (true);

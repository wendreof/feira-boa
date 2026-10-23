-- Display name used to greet the user in notifications and future emails.
-- Email/password signup requires it in the UI; Google sign-in can prefill
-- from the provider profile and the user can change it later.

alter table public.profiles add column if not exists display_name text;

-- Keep names reasonable without forcing a specific format.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_display_name_length'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_display_name_length
      check (display_name is null or char_length(btrim(display_name)) between 2 and 30);
  end if;
end;
$$;

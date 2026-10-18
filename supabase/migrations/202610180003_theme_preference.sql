-- Persist the default appearance choice in the existing user preference JSON.
alter table public.profiles
  alter column preferences
  set default '{"favoriteStores":[],"favoriteProductTypes":[],"theme":"light"}'::jsonb;

update public.profiles
set preferences = jsonb_set(preferences, '{theme}', '"light"'::jsonb, true)
where not (preferences ? 'theme');

alter table public.profiles
  add constraint profiles_preferences_theme_valid
  check (preferences ->> 'theme' is null or preferences ->> 'theme' in ('light', 'dark'));

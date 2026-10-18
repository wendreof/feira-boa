-- Use category/type names for account favorites; keep favorite offer IDs separate.
alter table public.profiles
  alter column preferences
  set default '{"favoriteStores":[],"favoriteProductTypes":[]}'::jsonb;

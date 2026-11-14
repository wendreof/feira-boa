type SupabaseModule = typeof import("@supabase/supabase-js");

type SupabaseGlobal = typeof globalThis & { FeiraBoaSupabaseJs?: SupabaseModule };

function loadSupabaseModule(): SupabaseModule {
  const mod = (globalThis as SupabaseGlobal).FeiraBoaSupabaseJs;
  if (!mod) {
    throw new Error("supabase-vendor.js must load before bundles that use Supabase.");
  }
  return mod;
}

export const createClient: SupabaseModule["createClient"] = ((...args) =>
  loadSupabaseModule().createClient(...args)) as SupabaseModule["createClient"];

export type {
  AuthChangeEvent,
  Session,
  User,
} from "@supabase/supabase-js";
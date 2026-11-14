import * as supabaseJs from "@supabase/supabase-js";

type SupabaseGlobal = typeof globalThis & { FeiraBoaSupabaseJs: typeof supabaseJs };

(globalThis as SupabaseGlobal).FeiraBoaSupabaseJs = supabaseJs;
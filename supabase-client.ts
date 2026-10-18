import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabasePublishableKey, supabaseUrl } from "./supabase-config";

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
});

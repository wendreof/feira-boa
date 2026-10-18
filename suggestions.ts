import { supabase } from "./supabase-client";

export type SuggestionCategory = "idea" | "bug" | "content" | "other";

export async function submitSuggestion(category: SuggestionCategory, message: string): Promise<void> {
  const { error } = await supabase.from("suggestions").insert({ category, message });
  if (error) throw error;
}

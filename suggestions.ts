import type { Database } from "./src/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SuggestionCategory = "idea" | "bug" | "content" | "other";

export interface SuggestionInput {
  category: SuggestionCategory;
  message: string;
  userId: string;
  honeypot: string;
}

export interface SuggestionRow {
  category: SuggestionCategory;
  message: string;
  user_id: string;
  honeypot: string;
}

export type SuggestionClient = Pick<SupabaseClient<Database>, "from">;

export const SUGGESTION_GUARD_MESSAGES = {
  honeypot: "Não foi possível registrar a sugestão.",
  cooldown: "Aguarde 60 segundos antes de enviar outra sugestão.",
  dailyLimit: "Cada conta pode enviar no máximo 3 sugestões por dia.",
  signIn: "Entre na sua conta para enviar uma sugestão.",
} as const;

export type SuggestionGuard = keyof typeof SUGGESTION_GUARD_MESSAGES;

export function buildSuggestionRow(input: SuggestionInput): SuggestionRow {
  return {
    category: input.category,
    message: input.message.trim(),
    user_id: input.userId,
    honeypot: input.honeypot,
  };
}

export async function submitSuggestion(client: SuggestionClient, input: SuggestionInput): Promise<void> {
  const { error } = await client.from("suggestions").insert(buildSuggestionRow(input));
  if (error) throw error;
}

export function detectSuggestionGuard(error: unknown): SuggestionGuard | null {
  const message = errorText(error);
  if (!message) return null;

  for (const guard of Object.keys(SUGGESTION_GUARD_MESSAGES) as SuggestionGuard[]) {
    if (message.includes(SUGGESTION_GUARD_MESSAGES[guard])) return guard;
  }

  return null;
}

function errorText(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
}

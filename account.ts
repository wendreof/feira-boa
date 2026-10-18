import type { User } from "@supabase/supabase-js";
import type { ProfilePreferences } from "./types";
import { supabase } from "./supabase-client";

const emptyPreferences: ProfilePreferences = {
  favoriteOfferIds: [],
  favoriteStores: [],
  favoriteProducts: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parsePreferences(value: unknown): ProfilePreferences {
  if (!isRecord(value)) return { ...emptyPreferences };
  return {
    favoriteOfferIds: stringList(value.favoriteOfferIds),
    favoriteStores: stringList(value.favoriteStores),
    favoriteProducts: stringList(value.favoriteProducts),
  };
}

export async function signIn(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signUp(email: string, password: string): Promise<{ user: User | null; confirmationRequired: boolean }> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return { user: data.user, confirmationRequired: data.session === null };
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke("delete-account");
  if (error) throw error;
  await signOut();
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function loadPreferences(userId: string): Promise<ProfilePreferences> {
  const { data, error } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return parsePreferences(data?.preferences);
}

export async function savePreferences(userId: string, preferences: ProfilePreferences): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: userId, preferences }, { onConflict: "user_id" });
  if (error) throw error;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ocorreu um erro. Tente novamente.";
}

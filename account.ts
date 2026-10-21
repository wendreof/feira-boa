import type { User } from "@supabase/supabase-js";
import type { ProfilePreferences } from "./types";
import { errorMessage } from "./errors";
import { supabase } from "./supabase-client";

export { errorMessage };

export interface AlertRule {
  id: string;
  store: string | null;
  product: string | null;
  product_type: string | null;
  target_price: number;
  enabled: boolean;
}

export interface NewAlertRule {
  store: string | null;
  product: string | null;
  product_type: string | null;
  target_price: number;
}

export interface AccountSettings {
  preferences: ProfilePreferences;
  notificationsPaused: boolean;
  pushEnabled: boolean;
  alertRules: AlertRule[];
}

const emptyPreferences: ProfilePreferences = {
  favoriteOfferIds: [],
  favoriteStores: [],
  favoriteProductTypes: [],
  theme: "light",
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
    favoriteProductTypes: stringList(value.favoriteProductTypes ?? value.favoriteProducts),
    theme: value.theme === "dark" ? "dark" : "light",
  };
}

export async function signIn(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

/**
 * Inicia o login com Google. O navegador é redirecionado para o provedor e
 * volta para `login.html`, que conclui a sessão e segue para o destino salvo.
 */
export async function signInWithGoogle(returnTo: string): Promise<void> {
  const redirectTo = new URL("login.html", window.location.origin);
  redirectTo.searchParams.set("returnTo", returnTo);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectTo.toString() },
  });
  if (error) throw error;
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
    .upsert({
      user_id: userId,
      preferences: {
        favoriteOfferIds: preferences.favoriteOfferIds,
        favoriteStores: preferences.favoriteStores,
        favoriteProductTypes: preferences.favoriteProductTypes,
        theme: preferences.theme,
      },
    }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function loadAccountSettings(userId: string): Promise<AccountSettings> {
  const [{ data: profile, error: profileError }, { data: rules, error: rulesError }, { count, error: pushError }] = await Promise.all([
    supabase.from("profiles").select("preferences, notifications_paused").eq("user_id", userId).maybeSingle(),
    supabase.from("alert_rules").select("id, store, product, product_type, target_price, enabled").eq("user_id", userId).order("created_at"),
    supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  if (profileError) throw profileError;
  if (rulesError) throw rulesError;
  if (pushError) throw pushError;
  return {
    preferences: parsePreferences(profile?.preferences),
    notificationsPaused: profile?.notifications_paused ?? false,
    pushEnabled: (count ?? 0) > 0,
    alertRules: rules ?? [],
  };
}

export async function loadAlertRules(userId: string): Promise<AlertRule[]> {
  const { data, error } = await supabase
    .from("alert_rules")
    .select("id, store, product, product_type, target_price, enabled")
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function createAlertRule(userId: string, rule: NewAlertRule): Promise<void> {
  const { error } = await supabase.from("alert_rules").insert({ user_id: userId, ...rule });
  if (error) throw error;
}

export async function removeAlertRule(userId: string, ruleId: string): Promise<void> {
  const { error } = await supabase.from("alert_rules").delete().eq("id", ruleId).eq("user_id", userId);
  if (error) throw error;
}

export async function setNotificationsPaused(userId: string, paused: boolean): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: userId, notifications_paused: paused }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function savePushSubscription(userId: string, subscription: PushSubscription): Promise<void> {
  const payload = subscription.toJSON();
  if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys.auth) {
    throw new Error("O navegador não forneceu os dados completos da inscrição.");
  }
  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: userId,
    endpoint: payload.endpoint,
    p256dh: payload.keys.p256dh,
    auth_key: payload.keys.auth,
  }, { onConflict: "endpoint" });
  if (error) throw error;
}

export async function removePushSubscription(userId: string, endpoint: string): Promise<void> {
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint);
  if (error) throw error;
}



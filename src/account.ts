import type { User } from "@supabase/supabase-js";
import type { ProfilePreferences } from "./types";
import { errorMessage } from "./errors";
import { supabase } from "./supabase-client";

export { errorMessage };

export interface AccountSettings {
  preferences: ProfilePreferences;
  displayName: string | null;
  pushEnabled: boolean;
  avatarPath: string | null;
}

export interface UserProfile {
  preferences: ProfilePreferences;
  avatarPath: string | null;
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

export async function signUp(email: string, password: string, displayName: string): Promise<{ user: User | null; confirmationRequired: boolean }> {
  const name = displayName.trim().replace(/\s+/g, " ");
  if (name.length < 2) throw new Error("Informe como gostaria de ser chamado (mínimo de 2 letras).");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: name } },
  });
  if (error) throw error;
  if (data.user) {
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ user_id: data.user.id, display_name: name }, { onConflict: "user_id" });
    // Confirmação de e-mail pode bloquear a tabela até a sessão existir;
    // o nome já fica no metadata do auth para importar no primeiro login.
    if (profileError) console.warn("Could not save display name during signup.", profileError);
  }
  return { user: data.user, confirmationRequired: data.session === null };
}

export async function loadDisplayName(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const name = data?.display_name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

export async function saveDisplayName(userId: string, displayName: string): Promise<string> {
  const name = displayName.trim().replace(/\s+/g, " ");
  if (name.length < 2) throw new Error("Informe como gostaria de ser chamado (mínimo de 2 letras).");
  if (name.length > 30) throw new Error("O nome pode ter no máximo 30 caracteres.");
  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: userId, display_name: name }, { onConflict: "user_id" });
  if (error) throw error;
  return name;
}

/** Preenche o nome a partir do Google quando a conta ainda não tem um. */
export async function importDisplayNameFromProvider(userId: string): Promise<string | null> {
  const existing = await loadDisplayName(userId);
  if (existing) return existing;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const metadata = data.user.user_metadata;
  const candidate = [metadata?.full_name, metadata?.name, metadata?.given_name]
    .find((value): value is string => typeof value === "string" && value.trim().length >= 2);
  if (!candidate) return null;
  return saveDisplayName(userId, candidate);
}

/**
 * Envia um link de redefinição de senha para o e-mail informado. O link volta
 * para `login.html`, que conclui a sessão de recuperação pelo hash da URL.
 */
export async function resetPasswordForEmail(email: string, returnTo: string): Promise<void> {
  const redirectTo = new URL("login.html", window.location.origin);
  redirectTo.searchParams.set("returnTo", returnTo);
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo.toString(),
  });
  if (error) throw error;
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

export async function loadPreferences(userId: string): Promise<UserProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("preferences, avatar_path")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const avatarPath = typeof data?.avatar_path === "string" && data.avatar_path.trim()
    ? data.avatar_path.trim()
    : null;
  return {
    preferences: parsePreferences(data?.preferences),
    avatarPath,
  };
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

/** Indica se a conta tem ao menos um dispositivo com notificações salvas. */
export async function hasPushSubscriptions(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function loadAccountSettings(userId: string): Promise<AccountSettings> {
  const [{ data: profile, error: profileError }, pushEnabled] = await Promise.all([
    supabase.from("profiles").select("preferences, display_name, avatar_path").eq("user_id", userId).maybeSingle(),
    hasPushSubscriptions(userId),
  ]);
  if (profileError) throw profileError;
  const displayName = typeof profile?.display_name === "string" && profile.display_name.trim()
    ? profile.display_name.trim()
    : null;
  const avatarPath = typeof profile?.avatar_path === "string" && profile.avatar_path.trim()
    ? profile.avatar_path.trim()
    : null;
  return {
    preferences: parsePreferences(profile?.preferences),
    displayName,
    pushEnabled,
    avatarPath,
  };
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



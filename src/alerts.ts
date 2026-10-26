import { supabase } from "./supabase-client";

/** Regra de alerta salva em `alert_rules` (RLS: somente o próprio usuário). */
export interface AlertRule {
  id: string;
  store: string | null;
  product: string | null;
  product_type: string | null;
  target_price: number;
  enabled: boolean;
  created_at: string;
}

/** Campos editáveis pelo formulário. */
export interface AlertRuleInput {
  store: string | null;
  product_type: string;
  target_price: number;
}

/** Envio registrado por `scripts/send-price-alerts.mjs` em `notification_log`. */
export interface NotificationEntry {
  offer_id: string;
  sent_at: string;
  result: "sent" | "failed";
  error_code: string | null;
}

const RULE_COLUMNS = "id, store, product, product_type, target_price, enabled, created_at";
const HISTORY_LIMIT = 100;

export async function loadAlertRules(userId: string): Promise<AlertRule[]> {
  const { data, error } = await supabase
    .from("alert_rules")
    .select(RULE_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createAlertRule(userId: string, input: AlertRuleInput): Promise<void> {
  const { error } = await supabase
    .from("alert_rules")
    .insert({ user_id: userId, product: null, ...input });
  if (error) throw error;
}

export async function updateAlertRule(userId: string, ruleId: string, input: AlertRuleInput): Promise<void> {
  const { error } = await supabase
    .from("alert_rules")
    .update(input)
    .eq("id", ruleId)
    .eq("user_id", userId);
  if (error) throw error;
}

/** Ativa ou desativa uma regra sem perder seus dados. */
export async function setAlertRuleEnabled(userId: string, ruleId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from("alert_rules")
    .update({ enabled })
    .eq("id", ruleId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteAlertRule(userId: string, ruleId: string): Promise<void> {
  const { error } = await supabase
    .from("alert_rules")
    .delete()
    .eq("id", ruleId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function loadNotificationsPaused(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("notifications_paused")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.notifications_paused ?? false;
}

export async function setNotificationsPaused(userId: string, paused: boolean): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: userId, notifications_paused: paused }, { onConflict: "user_id" });
  if (error) throw error;
}

/** Envios mais recentes para o usuário, do mais novo para o mais antigo. */
export async function loadNotificationHistory(userId: string): Promise<NotificationEntry[]> {
  const { data, error } = await supabase
    .from("notification_log")
    .select("offer_id, sent_at, result, error_code")
    .eq("user_id", userId)
    .order("sent_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw error;
  return data ?? [];
}

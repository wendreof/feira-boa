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
  /** Texto exato enviado. Nulo em envios anteriores à gravação do conteúdo. */
  title: string | null;
  body: string | null;
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

export async function deleteAlertRule(userId: string, ruleId: string): Promise<void> {
  const { error } = await supabase
    .from("alert_rules")
    .delete()
    .eq("id", ruleId)
    .eq("user_id", userId);
  if (error) throw error;
}

/** Mensagens enviadas ao usuário, da mais nova para a mais antiga. */
export async function loadNotificationHistory(userId: string): Promise<NotificationEntry[]> {
  const { data, error } = await supabase
    .from("notification_log")
    .select("offer_id, sent_at, result, error_code, title, body")
    .eq("user_id", userId)
    .order("sent_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw error;
  return data ?? [];
}

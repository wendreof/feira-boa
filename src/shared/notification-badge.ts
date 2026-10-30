import { supabase } from "../supabase-client";

const LINK_SELECTOR = '[data-sidebar-link="messages"]';
const BASE_LABEL = "Notificações";

/** Desenha (ou remove, com 0) o contador em todos os links de Notificações da página. */
export function setNotificationBadge(count: number): void {
  document.querySelectorAll<HTMLElement>(LINK_SELECTOR).forEach((link) => {
    let badge = link.querySelector<HTMLElement>(".nav-badge");
    if (count <= 0) {
      badge?.remove();
      link.setAttribute("aria-label", BASE_LABEL);
      return;
    }
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "nav-badge";
      badge.setAttribute("aria-hidden", "true");
      link.append(badge);
    }
    badge.textContent = count > 9 ? "9+" : String(count);
    link.setAttribute("aria-label", `${BASE_LABEL}, ${count} não lidas`);
  });
}

async function currentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user.id ?? null;
}

/** Quantidade de envios bem-sucedidos posteriores à última abertura da página Mensagens. */
export async function loadUnreadCount(): Promise<number> {
  const userId = await currentUserId();
  if (!userId) return 0;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("messages_seen_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) throw profileError;

  let query = supabase
    .from("notification_log")
    .select("offer_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("result", "sent");
  if (profile?.messages_seen_at) query = query.gt("sent_at", profile.messages_seen_at);

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

// Cada leitura do contador recebe um número; uma consulta antiga que termina depois
// de markMessagesSeen não pode reabrir o contador.
let generation = 0;

/** Marca as mensagens como lidas (a página Mensagens chama ao abrir) e zera o contador. */
export async function markMessagesSeen(): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const { error } = await supabase
    .from("profiles")
    .update({ messages_seen_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw error;
  generation += 1;
  setNotificationBadge(0);
}

/** Atualiza o contador a partir do estado atual da sessão (carregamento, foco e troca de login). */
export async function refreshNotificationBadge(): Promise<void> {
  if (document.querySelector(LINK_SELECTOR) === null) return;
  const started = generation;
  try {
    const count = await loadUnreadCount();
    if (started === generation) setNotificationBadge(count);
  } catch (error: unknown) {
    console.warn("Could not load the unread message count.", error);
  }
}

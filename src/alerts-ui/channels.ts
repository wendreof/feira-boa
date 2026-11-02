// Canais de notificação da página de alertas.
// Cada canal implementa a mesma interface; para adicionar um canal, crie uma
// entrada em CHANNELS. A lista é renderizada sozinha.
import { errorMessage } from "../errors";
import { removePushSubscription, savePushSubscription } from "../account";
import { supabase } from "../supabase-client";
import { TELEGRAM_BOT_USERNAME } from "../telegram-config";
import { showToast } from "../shared/toast";
import { getPushSubscription, isPushConfigured, subscribeToPush, unsubscribeFromPush } from "../push";

interface ChannelLinkState {
  linked: boolean;
  deliveryBlocked: boolean;
}

interface ChannelImpl {
  id: string;
  name: string;
  description: string;
  available(): boolean;
  load(userId: string): Promise<ChannelLinkState>;
  connect(userId: string): Promise<void>;
  disconnect(userId: string): Promise<void>;
  waitingHint?: string;
  /** Texto fixo de compatibilidade (ex.: navegadores). */
  supportHint?: string;
}

interface ChannelStatus {
  linked: boolean;
  pending: boolean;
  deliveryBlocked: boolean;
}

const LINK_TTL_MS = 24 * 60 * 60 * 1000;
const PENDING_POLL_MS = 3000;
const PENDING_POLL_MAX_MS = 120_000;

let pendingPollTimer: ReturnType<typeof setInterval> | null = null;
let pendingPollUntil = 0;

function stopPendingPoll(): void {
  if (pendingPollTimer !== null) {
    clearInterval(pendingPollTimer);
    pendingPollTimer = null;
  }
}

function startPendingPoll(onChange: () => void): void {
  stopPendingPoll();
  pendingPollUntil = Date.now() + PENDING_POLL_MAX_MS;
  pendingPollTimer = setInterval(async () => {
    if (!currentUserId || Date.now() > pendingPollUntil) {
      stopPendingPoll();
      return;
    }
    await refreshChannelStates(currentUserId);
    renderChannels();
    onChange();
    const telegram = statuses.get("telegram");
    if (telegram?.linked) {
      stopPendingPoll();
      setFeedback("Telegram conectado. Você receberá os avisos por lá.");
    }
  }, PENDING_POLL_MS);
}

function channelErrorMessage(error: unknown): string {
  const message = errorMessage(error);
  if (/push service error|registration failed/i.test(message)) {
    return "O navegador não conseguiu registrar push (serviço recusou). Atualize a página, confirme HTTPS e tente de novo. Em Chrome: Configurações → Privacidade → notificações permitidas para este site.";
  }
  return message;
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const telegram: ChannelImpl = {
  id: "telegram",
  name: "Telegram",
  description: "Receba os avisos de preço como mensagem no Telegram.",
  waitingHint: "Abra o Telegram e toque em Iniciar no bot. A confirmação costuma ser instantânea; esta página atualiza sozinha.",
  available: () => TELEGRAM_BOT_USERNAME.length > 0,
  async load(userId) {
    const { data, error } = await supabase
      .from("telegram_links")
      .select("user_id, delivery_blocked")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { linked: false, deliveryBlocked: false };
    return { linked: true, deliveryBlocked: Boolean(data.delivery_blocked) };
  },
  async connect(userId) {
    const token = randomToken();
    window.open(`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${token}`, "_blank", "noopener");
    const { error: clearError } = await supabase.from("telegram_link_tokens").delete().eq("user_id", userId);
    if (clearError) throw clearError;
    const expiresAt = new Date(Date.now() + LINK_TTL_MS).toISOString();
    const { error } = await supabase.from("telegram_link_tokens").insert({ token, user_id: userId, expires_at: expiresAt });
    if (error) throw error;
  },
  async disconnect(userId) {
    const { error: tokenError } = await supabase.from("telegram_link_tokens").delete().eq("user_id", userId);
    if (tokenError) throw tokenError;
    const { error } = await supabase.from("telegram_links").delete().eq("user_id", userId);
    if (error) throw error;
  },
};

const browserPush: ChannelImpl = {
  id: "push",
  name: "Navegador",
  description: "Receba avisos de preço como notificação neste dispositivo (gratuito).",
  supportHint: "Recomendado: Chrome ou Edge. O Brave pode bloquear notificações — use o Telegram nesse caso.",
  available: () => isPushConfigured() && "Notification" in window && "serviceWorker" in navigator,
  async load(userId) {
    const local = await getPushSubscription();
    if (!local?.endpoint) return { linked: false, deliveryBlocked: false };
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint")
      .eq("user_id", userId)
      .eq("endpoint", local.endpoint)
      .maybeSingle();
    if (error) throw error;
    return { linked: Boolean(data), deliveryBlocked: false };
  },
  async connect(userId) {
    const approved = window.confirm(
      "A Feira Boa enviará alertas de preço que você criou, com produto, loja, preço e validade. Ativar neste navegador?",
    );
    if (!approved) return;
    const prior = await getPushSubscription();
    if (prior) await prior.unsubscribe().catch(() => undefined);
    const subscription = await subscribeToPush();
    await savePushSubscription(userId, subscription);
  },
  async disconnect(userId) {
    const subscription = await getPushSubscription();
    if (subscription?.endpoint) await removePushSubscription(userId, subscription.endpoint);
    await unsubscribeFromPush();
  },
};

/** Canais disponíveis, na ordem em que aparecem na página. */
const CHANNELS: ChannelImpl[] = [telegram, browserPush];

const statuses = new Map<string, ChannelStatus>();
let currentUserId: string | null = null;

const list = document.querySelector<HTMLUListElement>("#notification-channels");
const feedback = document.querySelector<HTMLElement>("#channel-feedback");

function setFeedback(message: string, isError = false): void {
  if (!feedback) return;
  feedback.textContent = message;
  feedback.hidden = !message;
  feedback.dataset.tone = isError ? "error" : "ok";
  if (message) showToast(message, isError ? "error" : "ok");
}

function statusFor(channel: ChannelImpl): ChannelStatus {
  return statuses.get(channel.id) ?? { linked: false, pending: false, deliveryBlocked: false };
}

async function refreshChannelStates(userId: string): Promise<void> {
  await Promise.all(CHANNELS.map(async (channel) => {
    try {
      const state = await channel.load(userId);
      const previous = statusFor(channel);
      statuses.set(channel.id, {
        linked: state.linked,
        deliveryBlocked: state.deliveryBlocked,
        pending: state.linked ? false : previous.pending,
      });
    } catch (error) {
      console.warn(`Could not load the ${channel.name} channel.`, error);
      statuses.set(channel.id, { linked: false, pending: false, deliveryBlocked: false });
    }
  }));
}

function channelBadge(channel: ChannelImpl, status: ChannelStatus): string {
  if (!channel.available()) return "Em breve";
  if (status.linked && status.deliveryBlocked) return "Bloqueado";
  if (status.linked) return "Conectado";
  if (status.pending) return "Aguardando";
  return "Desconectado";
}

function actionButton(label: string, action: string, channelId: string, className = "account-button"): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.dataset.channelAction = action;
  button.dataset.channelId = channelId;
  button.textContent = label;
  return button;
}

function renderChannel(channel: ChannelImpl): HTMLLIElement {
  const status = statusFor(channel);
  const item = document.createElement("li");
  item.className = `channel-card${status.linked ? " is-linked" : ""}`;

  const head = document.createElement("div");
  head.className = "channel-card-head";
  const name = document.createElement("strong");
  name.textContent = channel.name;
  const badge = document.createElement("span");
  badge.className = "channel-badge";
  badge.dataset.state = channel.available()
    ? (status.linked && status.deliveryBlocked ? "blocked" : status.linked ? "linked" : status.pending ? "pending" : "off")
    : "soon";
  badge.textContent = channelBadge(channel, status);
  head.append(name, badge);

  const description = document.createElement("p");
  description.className = "channel-desc";
  description.textContent = channel.description;

  const actions = document.createElement("div");
  actions.className = "channel-actions";
  if (!channel.available()) {
    const soon = document.createElement("p");
    soon.className = "channel-hint";
    soon.textContent = "Disponível em breve.";
    actions.append(soon);
  } else if (status.linked && status.deliveryBlocked) {
    const hint = document.createElement("p");
    hint.className = "channel-hint";
    hint.textContent = "O Telegram bloqueou mensagens deste bot. Desbloqueie o bot no app e toque em Reconectar.";
    actions.append(hint, actionButton("Reconectar", "connect", channel.id));
    actions.append(actionButton("Desconectar", "disconnect", channel.id, "account-button secondary danger-action"));
  } else if (status.linked) {
    actions.append(actionButton("Desconectar", "disconnect", channel.id, "account-button secondary danger-action"));
  } else if (status.pending) {
    const hint = document.createElement("p");
    hint.className = "channel-hint";
    hint.textContent = channel.waitingHint ?? "";
    actions.append(hint, actionButton("Verificar conexão", "check", channel.id), actionButton("Gerar novo link", "connect", channel.id, "account-button secondary"));
  } else {
    actions.append(actionButton("Conectar", "connect", channel.id));
  }

  item.append(head, description);
  if (channel.supportHint && channel.available()) {
    const support = document.createElement("p");
    support.className = "channel-hint";
    support.textContent = channel.supportHint;
    item.append(support);
  }
  item.append(actions);
  return item;
}

export function renderChannels(): void {
  if (!list) return;
  list.replaceChildren(...CHANNELS.map(renderChannel));
}

/** Carrega o estado de todos os canais para a conta. Falhas viram "desconectado". */
export async function loadChannels(userId: string): Promise<void> {
  currentUserId = userId;
  await refreshChannelStates(userId);
  renderChannels();
}

/** True quando ao menos um canal está conectado e pode receber envios. */
export function anyChannelLinked(): boolean {
  return [...statuses.values()].some((status) => status.linked && !status.deliveryBlocked);
}

async function runAction(action: string, channel: ChannelImpl, onChange: () => void): Promise<void> {
  if (!currentUserId) return;
  const userId = currentUserId;
  try {
    if (action === "connect") {
      setFeedback("");
      await channel.connect(userId);
      if (channel.id === "push") {
        await refreshChannelStates(userId);
        const status = statusFor(channel);
        statuses.set(channel.id, { linked: status.linked, pending: false, deliveryBlocked: false });
        setFeedback(status.linked
          ? "Navegador conectado neste dispositivo. Os avisos chegam aqui e no celular se você conectar lá também."
          : "Não foi possível confirmar a inscrição neste navegador. Tente Conectar de novo.", !status.linked);
      } else {
        statuses.set(channel.id, { linked: false, pending: true, deliveryBlocked: false });
        setFeedback(`Link gerado. Confirme a conexão no ${channel.name}.`);
        startPendingPoll(onChange);
      }
    } else if (action === "check") {
      await refreshChannelStates(userId);
      const status = statusFor(channel);
      statuses.set(channel.id, { ...status, pending: !status.linked });
      if (status.linked && status.deliveryBlocked) {
        setFeedback("Telegram vinculado, mas o bot está bloqueado. Desbloqueie no app e reconecte.", true);
      } else {
        setFeedback(status.linked ? `${channel.name} conectado. Você receberá os avisos por lá.` : `Ainda não recebemos a confirmação no ${channel.name}. Toque em Iniciar no bot e tente de novo.`);
      }
    } else if (action === "disconnect") {
      if (!window.confirm(`Desconectar o ${channel.name}? Você deixará de receber os avisos por ele.`)) return;
      await channel.disconnect(userId);
      stopPendingPoll();
      statuses.set(channel.id, { linked: false, pending: false, deliveryBlocked: false });
      setFeedback(`${channel.name} desconectado.`);
    }
  } catch (error) {
    setFeedback(`Não foi possível concluir: ${channelErrorMessage(error)}`, true);
  }
  renderChannels();
  onChange();
}

/** Liga os botões da lista. `onChange` roda depois de cada mudança de estado. */
export function bindChannels(onChange: () => void): void {
  list?.addEventListener("click", async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-channel-action]");
    if (!button) return;
    const channel = CHANNELS.find((item) => item.id === button.dataset.channelId);
    if (!channel) return;
    button.disabled = true;
    await runAction(button.dataset.channelAction ?? "", channel, onChange);
    button.disabled = false;
  });
}

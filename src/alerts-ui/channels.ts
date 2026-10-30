// Canais de notificação da página de alertas.
// Cada canal implementa a mesma interface; para adicionar um canal, crie uma
// entrada em CHANNELS. A lista é renderizada sozinha.
import { errorMessage } from "../errors";
import { supabase } from "../supabase-client";
import { TELEGRAM_BOT_USERNAME } from "../telegram-config";

interface ChannelImpl {
  id: string;
  name: string;
  description: string;
  /** Falso enquanto o canal não estiver configurado; aparece como "Em breve". */
  available(): boolean;
  /** Indica se a conta já tem este canal conectado. */
  load(userId: string): Promise<boolean>;
  /** Inicia a conexão. Pode deixar o canal aguardando confirmação do usuário. */
  connect(userId: string): Promise<void>;
  disconnect(userId: string): Promise<void>;
  /** Texto de orientação exibido enquanto a conexão aguarda confirmação. */
  waitingHint?: string;
}

interface ChannelStatus {
  linked: boolean;
  pending: boolean;
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
  waitingHint: "Abra o Telegram, toque em Iniciar no bot e depois em Verificar conexão.",
  available: () => TELEGRAM_BOT_USERNAME.length > 0,
  async load(userId) {
    const { data, error } = await supabase.from("telegram_links").select("user_id").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data !== null;
  },
  async connect(userId) {
    const token = randomToken();
    // Abre a janela antes de qualquer await: depois de uma espera o navegador bloqueia como pop-up.
    window.open(`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${token}`, "_blank", "noopener");
    const { error: clearError } = await supabase.from("telegram_link_tokens").delete().eq("user_id", userId);
    if (clearError) throw clearError;
    const { error } = await supabase.from("telegram_link_tokens").insert({ token, user_id: userId });
    if (error) throw error;
  },
  async disconnect(userId) {
    const { error: tokenError } = await supabase.from("telegram_link_tokens").delete().eq("user_id", userId);
    if (tokenError) throw tokenError;
    const { error } = await supabase.from("telegram_links").delete().eq("user_id", userId);
    if (error) throw error;
  },
};

/** Canais disponíveis, na ordem em que aparecem na página. */
const CHANNELS: ChannelImpl[] = [telegram];

const statuses = new Map<string, ChannelStatus>();
let currentUserId: string | null = null;

const list = document.querySelector<HTMLUListElement>("#notification-channels");
const feedback = document.querySelector<HTMLElement>("#channel-feedback");

function setFeedback(message: string, isError = false): void {
  if (!feedback) return;
  feedback.textContent = message;
  feedback.hidden = !message;
  feedback.dataset.tone = isError ? "error" : "ok";
}

function statusFor(channel: ChannelImpl): ChannelStatus {
  return statuses.get(channel.id) ?? { linked: false, pending: false };
}

function channelBadge(channel: ChannelImpl, status: ChannelStatus): string {
  if (!channel.available()) return "Em breve";
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
  badge.dataset.state = channel.available() ? (status.linked ? "linked" : status.pending ? "pending" : "off") : "soon";
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

  item.append(head, description, actions);
  return item;
}

export function renderChannels(): void {
  if (!list) return;
  list.replaceChildren(...CHANNELS.map(renderChannel));
}

/** Carrega o estado de todos os canais para a conta. Falhas viram "desconectado". */
export async function loadChannels(userId: string): Promise<void> {
  currentUserId = userId;
  await Promise.all(CHANNELS.map(async (channel) => {
    try {
      const linked = await channel.load(userId);
      statuses.set(channel.id, { linked, pending: linked ? false : statusFor(channel).pending });
    } catch (error) {
      console.warn(`Could not load the ${channel.name} channel.`, error);
      statuses.set(channel.id, { linked: false, pending: false });
    }
  }));
  renderChannels();
}

/** True quando ao menos um canal está conectado (usado no aviso do topo). */
export function anyChannelLinked(): boolean {
  return [...statuses.values()].some((status) => status.linked);
}

async function runAction(action: string, channel: ChannelImpl): Promise<void> {
  if (!currentUserId) return;
  const userId = currentUserId;
  try {
    if (action === "connect") {
      setFeedback("");
      await channel.connect(userId);
      statuses.set(channel.id, { linked: false, pending: true });
      setFeedback(`Link gerado. Confirme a conexão no ${channel.name}.`);
    } else if (action === "check") {
      const linked = await channel.load(userId);
      statuses.set(channel.id, { linked, pending: !linked });
      setFeedback(linked ? `${channel.name} conectado. Você receberá os avisos por lá.` : `Ainda não recebemos a confirmação no ${channel.name}. Toque em Iniciar no bot e tente de novo.`);
    } else if (action === "disconnect") {
      if (!window.confirm(`Desconectar o ${channel.name}? Você deixará de receber os avisos por ele.`)) return;
      await channel.disconnect(userId);
      statuses.set(channel.id, { linked: false, pending: false });
      setFeedback(`${channel.name} desconectado.`);
    }
  } catch (error) {
    setFeedback(`Não foi possível concluir: ${errorMessage(error)}`, true);
  }
  renderChannels();
}

/** Liga os botões da lista. `onChange` roda depois de cada mudança de estado. */
export function bindChannels(onChange: () => void): void {
  list?.addEventListener("click", async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-channel-action]");
    if (!button) return;
    const channel = CHANNELS.find((item) => item.id === button.dataset.channelId);
    if (!channel) return;
    button.disabled = true;
    await runAction(button.dataset.channelAction ?? "", channel);
    onChange();
  });
}

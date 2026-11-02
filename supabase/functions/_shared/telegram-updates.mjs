/** Extrai o token de `/start <token>` (ou `/start@bot <token>`). Retorna null se não houver. */
export function parseStartToken(text) {
  const match = /^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{16,64})\s*$/.exec(String(text ?? "").trim());
  return match ? match[1] : null;
}

export function buildTelegramBotCopy(siteUrl, botUsername) {
  const alertsUrl = new URL("alertas.html", siteUrl).href;
  const botLink = botUsername ? `https://t.me/${botUsername}` : alertsUrl;
  return {
    alertsUrl,
    botLink,
    linked: (activeRules) =>
      `Pronto! Seus alertas de preço chegam por aqui.${activeRules > 0 ? `\nVocê tem ${activeRules} alerta(s) ativo(s).` : ""}\n\nGerencie em:\n${alertsUrl}`,
    expired: `Este link expirou ou já foi usado. Gere um novo link em:\n${alertsUrl}`,
    help: `Para receber alertas de preço:\n1) Abra ${alertsUrl}\n2) Toque em Conectar Telegram\n3) Toque em Iniciar neste bot\n\nBot: ${botLink}`,
    unknown: `Comandos: /status · /pausar · /retomar · /desvincular\n\nConfigure alertas em:\n${alertsUrl}`,
    notLinked: `Conta ainda não vinculada. Conecte pelo site:\n${alertsUrl}`,
    status: ({ activeRules, paused, blocked }) => {
      if (blocked) return "Entrega pausada: o Telegram bloqueou mensagens deste bot. Desbloqueie o bot e reconecte em alertas no site.";
      if (paused) return `Alertas pausados. ${activeRules} regra(s) ativa(s). Use /retomar para voltar a receber avisos.`;
      return `Conectado. ${activeRules} alerta(s) ativo(s). Você receberá avisos quando houver ofertas dentro dos seus preços-alvo.`;
    },
    paused: "Alertas pausados. Você não receberá novos avisos até usar /retomar.",
    resumed: "Alertas retomados. Você voltará a receber avisos quando houver ofertas compatíveis.",
    unlinked: `Telegram desvinculado. Para reconectar:\n${alertsUrl}`,
  };
}

async function activeRuleCount(supabase, userId) {
  const { count, error } = await supabase
    .from("alert_rules")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("enabled", true);
  if (error) throw error;
  return count ?? 0;
}

async function userIdForChat(supabase, chatId) {
  const { data, error } = await supabase.from("telegram_links").select("user_id, delivery_blocked").eq("chat_id", chatId).maybeSingle();
  if (error) throw error;
  return data;
}

async function reply(sendMessage, token, chatId, text) {
  try {
    await sendMessage(token, chatId, text);
  } catch (error) {
    console.warn(`Could not reply in Telegram chat ${chatId}: ${error?.message ?? error}`);
  }
}

export async function processTelegramUpdate(update, {
  supabase,
  token,
  now = new Date(),
  sendMessage,
  copy,
}) {
  const message = update.message;
  const chatId = message?.chat?.id;
  if (!chatId) return null;

  const text = String(message?.text ?? "").trim();
  const startToken = parseStartToken(text);
  if (startToken) {
    return linkStartToken({ supabase, token, chatId, startToken, now, sendMessage, copy });
  }

  if (/^\/start(?:@\w+)?\s*$/.test(text)) {
    await reply(sendMessage, token, chatId, copy.help);
    return "help";
  }

  const command = text.split(/\s+/)[0]?.toLowerCase().replace(/@\w+$/, "");
  if (command === "/status" || command === "/pausar" || command === "/retomar" || command === "/desvincular") {
    return handleCommand({ supabase, token, chatId, command, sendMessage, copy });
  }

  if (text.startsWith("/")) {
    await reply(sendMessage, token, chatId, copy.unknown);
    return "command";
  }

  return "ignored";
}

async function linkStartToken({ supabase, token, chatId, startToken, now, sendMessage, copy }) {
  try {
    const { data: row, error } = await supabase
      .from("telegram_link_tokens")
      .select("user_id, expires_at")
      .eq("token", startToken)
      .maybeSingle();
    if (error) throw error;

    if (!row || Date.parse(row.expires_at) <= now.getTime()) {
      await reply(sendMessage, token, chatId, copy.expired);
      return "expired";
    }

    const { error: releaseError } = await supabase.from("telegram_links").delete().eq("chat_id", chatId).neq("user_id", row.user_id);
    if (releaseError) throw releaseError;

    const { error: linkError } = await supabase.from("telegram_links").upsert(
      {
        user_id: row.user_id,
        chat_id: chatId,
        linked_at: now.toISOString(),
        delivery_blocked: false,
        delivery_blocked_at: null,
      },
      { onConflict: "user_id" },
    );
    if (linkError) throw linkError;

    const { error: consumeError } = await supabase.from("telegram_link_tokens").delete().eq("token", startToken);
    if (consumeError) throw consumeError;

    const activeRules = await activeRuleCount(supabase, row.user_id);
    await reply(sendMessage, token, chatId, copy.linked(activeRules));
    return "linked";
  } catch (error) {
    console.error(`Telegram link failed for chat ${chatId}: ${error?.message ?? error}`);
    return null;
  }
}

async function handleCommand({ supabase, token, chatId, command, sendMessage, copy }) {
  const link = await userIdForChat(supabase, chatId);
  if (!link?.user_id) {
    await reply(sendMessage, token, chatId, copy.notLinked);
    return "command";
  }

  const userId = link.user_id;
  if (command === "/status") {
    const activeRules = await activeRuleCount(supabase, userId);
    const { data: profile } = await supabase.from("profiles").select("notifications_paused").eq("user_id", userId).maybeSingle();
    await reply(sendMessage, token, chatId, copy.status({
      activeRules,
      paused: Boolean(profile?.notifications_paused),
      blocked: Boolean(link.delivery_blocked),
    }));
    return "command";
  }

  if (command === "/pausar") {
    await supabase.from("profiles").update({ notifications_paused: true }).eq("user_id", userId);
    await reply(sendMessage, token, chatId, copy.paused);
    return "command";
  }

  if (command === "/retomar") {
    await supabase.from("profiles").update({ notifications_paused: false }).eq("user_id", userId);
    await reply(sendMessage, token, chatId, copy.resumed);
    return "command";
  }

  if (command === "/desvincular") {
    await supabase.from("telegram_links").delete().eq("user_id", userId);
    await supabase.from("telegram_link_tokens").delete().eq("user_id", userId);
    await reply(sendMessage, token, chatId, copy.unlinked);
    return "command";
  }

  return "command";
}

export async function processTelegramUpdates(updates, deps) {
  const counts = { updates: updates.length, linked: 0, expired: 0, help: 0, command: 0, ignored: 0 };
  for (const update of updates) {
    const result = await processTelegramUpdate(update, deps);
    if (result && counts[result] !== undefined) counts[result] += 1;
  }
  return counts;
}

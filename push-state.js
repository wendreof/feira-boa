export function resolvePushUiState({ deviceEnabled, accountEnabled, permissionDenied }) {
  const status = deviceEnabled
    ? "Ativado neste dispositivo"
    : permissionDenied
      ? "Bloqueado nas permissões do navegador"
      : accountEnabled
        ? "Ativado em outro dispositivo"
        : "Ainda não ativado";

  return {
    status,
    enableLabel: accountEnabled ? "Ativar neste dispositivo" : "Ativar notificações",
    showEnable: !deviceEnabled,
    disableEnable: permissionDenied,
    showDisable: deviceEnabled,
    showPermissionHelp: permissionDenied && !deviceEnabled,
    showAccountContext: accountEnabled && !deviceEnabled && !permissionDenied,
  };
}

/**
 * Considera o dispositivo ativo quando o SDK confirma a inscrição ou quando a
 * ativação acabou de ser concluída com a permissão concedida pelo navegador.
 * O SDK pode atualizar `optedIn` apenas depois do evento de permissão, então a
 * permissão real do navegador é a prova de que o dispositivo pode receber push.
 */
export function isDevicePushEnabled({ permission, optedIn, activatedNow = false }) {
  if (optedIn === true) return true;
  return activatedNow === true && permission === "granted";
}

function errorText(error) {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
      ? error.message
      : String(error ?? "");
  const name = error instanceof Error ? error.name : "";
  return { name, message, normalized: `${name} ${message}`.toLowerCase().trim() };
}

export function pushFailureMessage(error) {
  const { name, message, normalized } = errorText(error);

  if (normalized.includes("pushserviceerror") || normalized.includes("push service error")) {
    return "O navegador não conseguiu criar a inscrição de push. Recarregue a página e tente de novo; se persistir, o navegador ou a rede pode estar bloqueando o serviço de notificações.";
  }
  if (normalized.includes("serviço de notificações não carregou")) {
    return "O serviço de notificações não carregou. Verifique a conexão, recarregue a página e tente novamente.";
  }
  if (normalized.includes("notallowed") || normalized.includes("denied") || normalized.includes("permissão bloqueada")) {
    return "As notificações estão bloqueadas neste navegador. Libere a permissão nas configurações do site e recarregue a página.";
  }
  if (normalized.includes("permissão não concedida")) {
    return "O navegador ainda não concedeu a permissão de notificação. Toque em “Ativar notificações” e aceite o aviso; se o aviso não aparecer, libere o site nas configurações do navegador.";
  }
  if (normalized.includes("não ativou as notificações")) {
    return "A permissão foi concedida, mas o navegador não confirmou a inscrição de push. Recarregue a página e confira o status acima antes de tentar de novo.";
  }
  if (normalized.includes("salvar este dispositivo")) {
    return "A permissão foi concedida, mas não foi possível salvar este dispositivo. Tente novamente.";
  }

  const detail = `${name} ${message}`.replace(/\s+/g, " ").trim();
  return detail
    ? `Não foi possível ativar as notificações neste dispositivo (${detail}). Tente novamente.`
    : "Não foi possível ativar as notificações neste dispositivo. Tente novamente.";
}

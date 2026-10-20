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

export function pushFailureMessage(error) {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
      ? error.message
      : String(error ?? "");
  const normalized = message.toLowerCase();

  if (normalized.includes("push service error")) {
    return "O navegador não conseguiu conectar ao serviço de push. Verifique a internet, desative VPN ou bloqueadores e tente novamente.";
  }
  if (normalized.includes("notallowed") || normalized.includes("denied") || normalized.includes("permissão bloqueada")) {
    return "As notificações estão bloqueadas neste navegador. Libere a permissão nas configurações do site e recarregue a página.";
  }
  if (normalized.includes("salvar este dispositivo")) {
    return "A permissão foi concedida, mas não foi possível salvar este dispositivo. Tente novamente.";
  }
  return "Não foi possível ativar as notificações neste dispositivo. Tente novamente.";
}

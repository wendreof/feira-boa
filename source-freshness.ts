export interface SourceAlert {
  url: string;
  store?: string | null;
  message: string;
}

interface SourceStatus {
  checkedAt?: string;
  lastSuccessAt?: string;
  error?: boolean;
  needsReview?: boolean;
}

declare global {
  interface Window {
    FEIRA_SOURCE_ALERTS?: SourceAlert[];
    FEIRA_SOURCE_STATUS?: Record<string, SourceStatus>;
  }
}

const MAX_SOURCE_AGE_MS = 24 * 60 * 60 * 1000;
const sourceDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

export function applySourceFreshness(): SourceAlert[] {
  const alerts = window.FEIRA_SOURCE_ALERTS ?? [];
  const sourceStatus = window.FEIRA_SOURCE_STATUS ?? {};

  document.querySelectorAll<HTMLElement>("[data-source-url]").forEach((element) => {
    const sourceUrl = element.dataset.sourceUrl ?? "";
    const reviewAlert = alerts.find((alert) => alert.url === sourceUrl);
    if (reviewAlert) {
      element.textContent = "A fonte mudou e aguarda conferência.";
      element.classList.add("source-freshness-warning");
      return;
    }

    const status = sourceStatus[sourceUrl];
    if (!status) return;

    const lastSuccess = status.lastSuccessAt ? new Date(status.lastSuccessAt) : null;
    const checked = status.checkedAt ? new Date(status.checkedAt) : null;
    const checkedLabel = checked && !Number.isNaN(checked.getTime())
      ? ` · verificada em ${sourceDate.format(checked)}`
      : "";
    const stale = lastSuccess !== null
      && !Number.isNaN(lastSuccess.getTime())
      && Date.now() - lastSuccess.getTime() > MAX_SOURCE_AGE_MS;

    if (status.needsReview) {
      element.textContent = `A fonte mudou e aguarda conferência${checkedLabel}`;
      element.classList.add("source-freshness-warning");
    } else if (stale) {
      element.textContent = "A fonte não é verificada há mais de 24 horas.";
      element.classList.add("source-freshness-error");
    } else if (status.error) {
      const successLabel = lastSuccess && !Number.isNaN(lastSuccess.getTime())
        ? ` Último acesso bem-sucedido: ${sourceDate.format(lastSuccess)}.`
        : " Ainda sem acesso bem-sucedido registrado.";
      element.textContent = `Não foi possível verificar a fonte agora.${successLabel}`;
      element.classList.add("source-freshness-error");
    } else if (checked && !Number.isNaN(checked.getTime())) {
      element.textContent = `Fonte consultada em ${sourceDate.format(checked)} · isso não confirma que os preços foram atualizados.`;
    }
  });

  return alerts;
}

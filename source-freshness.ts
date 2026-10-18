export interface SourceAlert {
  url: string;
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
    const checked = status.checkedAt ? new Date(`${status.checkedAt}T00:00:00`) : null;
    const checkedLabel = checked && !Number.isNaN(checked.getTime())
      ? ` · verificada em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(checked)}`
      : "";

    if (status.needsReview) {
      element.textContent = `A fonte mudou e aguarda conferência${checkedLabel}`;
      element.classList.add("source-freshness-warning");
    } else if (status.error) {
      const successLabel = lastSuccess && !Number.isNaN(lastSuccess.getTime())
        ? ` Último acesso bem-sucedido: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(lastSuccess)}.`
        : " Ainda sem acesso bem-sucedido registrado.";
      element.textContent = `Não foi possível verificar a fonte agora.${successLabel}`;
      element.classList.add("source-freshness-error");
    } else if (checked) {
      element.textContent = `Fonte consultada em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(checked)} · isso não confirma que os preços foram atualizados.`;
    }
  });

  return alerts;
}
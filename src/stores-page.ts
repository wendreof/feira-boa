import { applySourceFreshness } from "./source-freshness";
import { initStoreRatings } from "./stores-ratings";

interface FeedStore {
  sourceUrl: string;
  source: string;
  from: string;
  to: string;
  flyerImages?: string[];
}

function formatShortDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function flyerButtonLabel(url: string): string {
  const file = url.split("/").pop()?.replace(/\.png$/i, "") ?? "Encarte";
  if (/FLV/i.test(file)) return "Hortifruti ↗";
  if (/ACOUGUE/i.test(file)) return "Açougue ↗";
  const page = file.match(/SPASSO-(\d+)/i)?.[1];
  if (page) return `Encarte ${page} ↗`;
  return "Ver encarte ↗";
}

function ensureSourceActions(card: HTMLElement): HTMLElement {
  let actions = card.querySelector<HTMLElement>(".source-actions");
  if (actions) return actions;
  const legacyButton = card.querySelector<HTMLElement>(".source-button");
  actions = document.createElement("div");
  actions.className = "source-actions";
  if (legacyButton) {
    legacyButton.classList.add("source-button--primary");
    actions.append(legacyButton);
    card.append(actions);
  } else {
    card.append(actions);
  }
  return actions;
}

// Validade vem do offers.json (a mesma fonte dos cards), para que a página não fique com datas antigas.
async function applyStoreMetadata(): Promise<void> {
  const response = await fetch("offers.json", { cache: "no-store" });
  if (!response.ok) return;
  const feed = (await response.json()) as { stores?: FeedStore[] };
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());

  for (const card of document.querySelectorAll<HTMLElement>(".store-source")) {
    const copy = card.querySelector<HTMLElement>(".source-copy");
    if (!copy) continue;
    const freshness = copy.querySelector<HTMLElement>("[data-source-url]");
    const validity = copy.querySelector<HTMLElement>("span:not(.source-kicker):not(.source-freshness)");
    const store = feed.stores?.find((entry) => entry.sourceUrl === freshness?.dataset.sourceUrl);
    if (!store) continue;

    if (validity) {
      const onlineNote = store.source.startsWith("Ofertas online") ? " Valores online podem diferir dos preços da loja física." : "";
      validity.textContent = store.to < today
        ? `Último período válido até ${formatShortDate(store.to)}.`
        : `Válido de ${store.from.slice(8)}/${store.from.slice(5, 7)} a ${formatShortDate(store.to)}.${onlineNote}`;
    }

    const flyerImages = store.flyerImages?.filter((url) => url.startsWith("https://"));
    if (!flyerImages?.length) continue;

    const actions = ensureSourceActions(card);
    for (const button of actions.querySelectorAll<HTMLAnchorElement>(".source-button:not(.source-button--primary)")) {
      button.remove();
    }
    for (const url of flyerImages) {
      const link = document.createElement("a");
      link.className = "source-button source-button--flyer";
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = flyerButtonLabel(url);
      actions.append(link);
    }
  }
}

void applyStoreMetadata().catch((error: unknown) => {
  console.warn("Could not load store metadata.", error);
});

applySourceFreshness();
void initStoreRatings().catch((error: unknown) => {
  console.warn("Could not initialize store ratings.", error);
});

for (const image of document.querySelectorAll<HTMLImageElement>(".source-logo img")) {
  const logo = image.parentElement;
  if (!logo) continue;
  if (image.complete && image.naturalWidth > 0) logo.classList.add("has-logo");
  image.addEventListener("load", () => logo.classList.add("has-logo"), { once: true });
  image.addEventListener("error", () => image.remove(), { once: true });
}

import { applySourceFreshness } from "./source-freshness";
import { initStoreRatings } from "./stores-ratings";

interface FeedStore {
  sourceUrl: string;
  source: string;
  from: string;
  to: string;
}

function formatShortDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

// Validade vem do offers.json (a mesma fonte dos cards), para que a página não fique com datas antigas.
async function applyStoreValidity(): Promise<void> {
  const response = await fetch("offers.json", { cache: "no-store" });
  if (!response.ok) return;
  const feed = (await response.json()) as { stores?: FeedStore[] };
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());

  for (const copy of document.querySelectorAll<HTMLElement>(".source-copy")) {
    const freshness = copy.querySelector<HTMLElement>("[data-source-url]");
    const validity = copy.querySelector<HTMLElement>("span:not(.source-kicker):not(.source-freshness)");
    const store = feed.stores?.find((entry) => entry.sourceUrl === freshness?.dataset.sourceUrl);
    if (!validity || !store) continue;
    const onlineNote = store.source.startsWith("Ofertas online") ? " Valores online podem diferir dos preços da loja física." : "";
    validity.textContent = store.to < today
      ? `Último período válido até ${formatShortDate(store.to)}.`
      : `Válido de ${store.from.slice(8)}/${store.from.slice(5, 7)} a ${formatShortDate(store.to)}.${onlineNote}`;
  }
}

void applyStoreValidity().catch((error: unknown) => {
  console.warn("Could not load store validity.", error);
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

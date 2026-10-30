// Limpa needs_review das fontes cujo snapshot novo passou na verificação de plausibilidade.
// Roda depois do monitor (sem ele, o monitor marcaria a fonte de novo pela mudança de hash).
// Snapshots que falham continuam marcados e as ofertas dessas lojas não geram alertas.
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { checkPlausibility } from "./feed/plausibility.mjs";

const STATE_URL = new URL("../.offer-monitor-state.json", import.meta.url);
// Mesmo nome de loja usado pelo monitor (.offer-monitor-state.json).
const STORES = [
  { id: "sempre", name: "Sempre Vale" },
  { id: "bigbom", name: "Big Bom" },
  { id: "corso", name: "Supermercado Corso" },
  { id: "paguemenos", name: "Pague Menos" },
  { id: "spasso", name: "Spasso Sabores" },
];

function committedSnapshot(id) {
  try {
    // Snapshots passam de 1 MB: o limite padrão do execFileSync faria a leitura falhar em silêncio.
    return JSON.parse(execFileSync("git", ["show", `HEAD:state/${id}.json`], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    }));
  } catch {
    return null;
  }
}

async function main() {
  const state = JSON.parse(await readFile(STATE_URL, "utf8"));
  const summary = [];
  let changed = false;

  for (const store of STORES) {
    let next;
    try {
      next = JSON.parse(await readFile(new URL(`../state/${store.id}.json`, import.meta.url), "utf8"));
    } catch {
      summary.push({ store: store.name, result: "sem snapshot" });
      continue;
    }
    const previous = committedSnapshot(store.id);
    if (JSON.stringify(previous) === JSON.stringify(next)) {
      summary.push({ store: store.name, result: "sem mudanças no snapshot" });
      continue;
    }

    const { ok, reasons } = checkPlausibility(previous, next);
    if (!ok) {
      summary.push({ store: store.name, result: "mantida em revisão", reasons });
      continue;
    }
    for (const entry of Object.values(state)) {
      if (entry && typeof entry === "object" && entry.store === store.name && entry.needs_review) {
        entry.needs_review = false;
        entry.review_note = "Liberada pela verificação automática de plausibilidade.";
        changed = true;
      }
    }
    summary.push({ store: store.name, result: "liberada pela verificação automática" });
  }

  if (changed) {
    await writeFile(STATE_URL, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    const { execFileSync: run } = await import("node:child_process");
    run(process.execPath, [fileURLToPath(new URL("./write-source-status.mjs", import.meta.url))], { stdio: "inherit" });
  }
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exitCode = 1;
});

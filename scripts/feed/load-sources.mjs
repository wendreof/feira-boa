import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { build } from "esbuild";

const ROOT = new URL("../../", import.meta.url);

/**
 * Carrega o catálogo curado de offers.ts (fallback de desenvolvimento) e
 * valida o mínimo esperado.
 */
export async function loadFallbackCatalog() {
  const { outputFiles } = await build({
    entryPoints: [fileURLToPath(new URL("src/offers.ts", ROOT))],
    bundle: true,
    format: "iife",
    globalName: "OfferCatalog",
    platform: "browser",
    target: "es2020",
    write: false,
  });
  const sandbox = {};
  vm.runInNewContext(outputFiles[0].text, sandbox, { filename: "offers.ts" });
  const catalog = sandbox.OfferCatalog;
  if (!Array.isArray(catalog.offers) || !Array.isArray(catalog.stores) || !Number.isFinite(Date.parse(catalog.offersUpdatedAt))) {
    throw new Error("Offer source did not produce offers and stores.");
  }
  return catalog;
}

/**
 * Lê os snapshots JSON de state/. Arquivos inválidos são ignorados; diretório
 * ausente resulta em lista vazia.
 */
export async function loadSnapshots() {
  const stateDir = new URL("state/", ROOT);
  let files;
  try {
    files = await readdir(stateDir);
  } catch {
    return [];
  }
  const snapshots = [];
  for (const file of files.filter((name) => name.endsWith(".json"))) {
    try {
      snapshots.push(JSON.parse(await readFile(new URL(file, stateDir), "utf8")));
    } catch {
      // Snapshot inválido: segue com os demais.
    }
  }
  return snapshots;
}

/**
 * Lê o encarte anterior de cada loja em state/previous/.
 */
export async function loadPreviousSnapshots() {
  const previousDir = new URL("state/previous/", ROOT);
  let files;
  try {
    files = await readdir(previousDir);
  } catch {
    return [];
  }
  const snapshots = [];
  for (const file of files.filter((name) => name.endsWith(".json"))) {
    try {
      snapshots.push(JSON.parse(await readFile(new URL(file, previousDir), "utf8")));
    } catch {
      // Ignora arquivo inválido.
    }
  }
  return snapshots;
}

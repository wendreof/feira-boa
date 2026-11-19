import { fetchWithRetry } from "./http.mjs";
import { geminiApiKey, resolveGeminiModel } from "./gemini-flyer.mjs";
import { jsonrepair } from "jsonrepair";

const DEFAULT_MAX_PER_CALL = 25;

/**
 * @param {Array<{ id?: string|null, name: string, productType: string, department: string, assigned: string }>} items
 * @param {{ modelEnvKeys?: string[], maxItems?: number }} [options]
 */
export async function suggestIconsViaGemini(items, options = {}) {
  const key = geminiApiKey();
  if (!key) {
    return { status: "skipped", reason: "GEMINI_API_KEY not set", suggestions: [] };
  }
  if (!items.length) {
    return { status: "skipped", reason: "no candidates", suggestions: [] };
  }

  const modelEnvKeys = options.modelEnvKeys ?? ["GEMINI_AUDIT_MODEL", "GEMINI_MODEL"];
  const chunkSize = Math.min(options.maxItems ?? DEFAULT_MAX_PER_CALL, DEFAULT_MAX_PER_CALL);
  /** @type {Array<{ id: string|null, suggestedIcon: string, rationale: string, assigned: string, agree: boolean }>} */
  const suggestions = [];

  for (let offset = 0; offset < items.length; offset += chunkSize) {
    const batch = items.slice(offset, offset + chunkSize);
    const prompt = [
      "You classify Brazilian supermarket product names into a single display emoji icon.",
      "Use one emoji only. Prefer food/household emojis already common in grocery apps.",
      "If unsure, return 🏷️.",
      "Return ONLY JSON:",
      `{ "items": [ { "id": "offer id or null", "icon": "emoji", "why": "short pt-BR reason" } ] }`,
      "Products:",
      JSON.stringify(
        batch.map((item) => ({
          id: item.id,
          name: item.name,
          productType: item.productType,
          department: item.department,
          currentIcon: item.assigned,
        })),
      ),
    ].join("\n");

    const model = resolveGeminiModel(modelEnvKeys);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetchWithRetry(
      endpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        }),
      },
      { attempts: 3, delayMs: 1_500, timeoutMs: 60_000 },
    );
    if (!res.ok) {
      const detail = await res.text();
      return { status: "error", reason: `Gemini failed (${res.status}): ${detail.slice(0, 200)}`, suggestions };
    }

    const payload = await res.json();
    const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text).join("") ?? "";
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = JSON.parse(jsonrepair(text));
    }
    for (const entry of parsed.items ?? []) {
      const row = batch.find((item) => item.id === entry.id) ?? batch.find((item) => item.name === entry.name);
      const assigned = row?.assigned ?? "🏷️";
      const suggested = String(entry.icon ?? "🏷️").trim() || "🏷️";
      suggestions.push({
        id: entry.id ?? row?.id ?? null,
        suggestedIcon: suggested,
        rationale: String(entry.why ?? "").trim(),
        assigned,
        agree: suggested === assigned,
        name: row?.name ?? "",
      });
    }
  }

  return { status: "ok", suggestions, model: resolveGeminiModel(modelEnvKeys) };
}
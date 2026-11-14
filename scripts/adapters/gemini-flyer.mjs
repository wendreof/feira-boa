import { jsonrepair } from "jsonrepair";
import { fetchWithRetry } from "./http.mjs";

export const USER_AGENT = "FeiraBoaOfferIngest/1.0 (official public flyer extraction)";
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

const BASE_CATEGORIES = [
  "Hortifruti",
  "Mercearia",
  "Laticínios",
  "Limpeza",
  "Bebidas",
  "Carnes",
  "Congelados",
  "Geral",
];

/**
 * @param {string[]} [extraCategories]
 */
export function campaignSchemaJson(extraCategories = []) {
  const categories = [...new Set([...BASE_CATEGORIES, ...extraCategories])];
  return `{
  "campaigns": [
    {
      "from": "YYYY-MM-DD",
      "to": "YYYY-MM-DD",
      "offers": [
        {
          "name": "product name without brand",
          "brand": "brand or empty string",
          "detail": "Unidade|Kg|500g|1L etc",
          "cat": "${categories.join("|")}",
          "price": 0.0,
          "oldPrice": 0.0 or null
        }
      ]
    }
  ]
}`;
}

export function geminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || "";
}

export function geminiExtractionEnabled() {
  return geminiApiKey().length > 0;
}

/**
 * @param {string} url
 * @param {{ label?: string, defaultMime?: string }} [options]
 */
export async function downloadFlyerImageBase64(url, options = {}) {
  const label = options.label ?? "flyer";
  const defaultMime = options.defaultMime ?? "image/jpeg";
  const res = await fetchWithRetry(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Could not download ${label} image (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || defaultMime;
  return { mime, data: buffer.toString("base64") };
}

/**
 * @param {string[]} modelEnvKeys
 */
export function resolveGeminiModel(modelEnvKeys) {
  for (const key of modelEnvKeys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return DEFAULT_GEMINI_MODEL;
}

/**
 * @param {object} params
 * @param {string} params.prompt
 * @param {{ mime: string, data: string }[]} params.images
 * @param {string[]} params.modelEnvKeys
 * @param {string} params.errorLabel
 * @param {number} [params.timeoutMs]
 */
export async function generateFlyerCampaignsViaGemini({
  prompt,
  images,
  modelEnvKeys,
  errorLabel,
  timeoutMs = 120_000,
}) {
  const key = geminiApiKey();
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set; cannot run flyer vision extraction.");
  }
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error(`${errorLabel} requires at least one flyer image.`);
  }

  const model = resolveGeminiModel(modelEnvKeys);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          ...images.map((image) => ({ inline_data: { mime_type: image.mime, data: image.data } })),
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  };

  const res = await fetchWithRetry(
    endpoint,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    { attempts: 5, delayMs: 2_000, timeoutMs },
  );
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini ${errorLabel} extraction failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const payload = await res.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text).join("") ?? "";
  return parseGeminiCampaignsJson(text, errorLabel);
}

/**
 * @param {string} text
 * @param {string} errorLabel
 */
export function parseGeminiCampaignsJson(text, errorLabel) {
  if (!text.trim()) throw new Error(`Gemini ${errorLabel} extraction returned empty content.`);

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    try {
      parsed = JSON.parse(jsonrepair(text));
    } catch {
      throw new Error(`Gemini ${errorLabel} extraction did not return valid JSON.`);
    }
  }

  if (!Array.isArray(parsed.campaigns)) {
    throw new Error(`Gemini ${errorLabel} extraction JSON is missing campaigns[].`);
  }
  return parsed.campaigns;
}
import { jsonrepair } from "jsonrepair";
import { fetchWithRetry } from "./http.mjs";

export const USER_AGENT = "FeiraBoaOfferIngest/1.0 (official public flyer extraction)";
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
/** Lighter model for daily audit / advisory scripts (quota-friendly). */
export const DEFAULT_GEMINI_AUDIT_MODEL = "gemini-3.5-flash-lite";

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

/** @param {unknown} error */
export function isTransientGeminiError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /\((503|429|500|502|504)\)/.test(message) ||
    /overloaded|unavailable|resource exhausted|rate limit/i.test(message) ||
    /terminated|aborted|ECONNRESET|fetch failed/i.test(message)
  );
}

/** @param {unknown} error */
export function isGeminiRateLimitError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /\(429\)/.test(message) || /rate limit|resource exhausted|quota exceeded/i.test(message);
}

/** CI ingest should not burn 25m on nested 429 backoffs. */
export function geminiIngestFastFailEnabled() {
  if (process.env.GEMINI_INGEST_FAST_FAIL === "0") return false;
  if (process.env.GEMINI_INGEST_FAST_FAIL === "1") return true;
  return process.env.GITHUB_ACTIONS === "true";
}

/** @returns {{ attempts: number, delayMs: number, maxRateLimitDelayMs: number, fetchAttempts: number }} */
export function resolveGeminiIngestRetryOptions() {
  if (geminiIngestFastFailEnabled()) {
    return { attempts: 2, delayMs: 3_000, maxRateLimitDelayMs: 20_000, fetchAttempts: 3 };
  }
  return { attempts: 6, delayMs: 5_000, maxRateLimitDelayMs: 120_000, fetchAttempts: 6 };
}

/**
 * @param {unknown} error
 * @param {number} attempt 1-based
 * @param {number} [baseDelayMs]
 * @param {number} [maxRateLimitDelayMs]
 */
export function geminiRetryDelayMs(error, attempt, baseDelayMs = 4_000, maxRateLimitDelayMs = 120_000) {
  const message = error instanceof Error ? error.message : String(error);
  const is429 = /\(429\)/.test(message) || /rate limit|resource exhausted/i.test(message);
  if (is429) {
    return Math.min(maxRateLimitDelayMs, 15_000 * 2 ** (attempt - 1));
  }
  return baseDelayMs * attempt;
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ attempts?: number, delayMs?: number, maxRateLimitDelayMs?: number }} [options]
 */
export async function withGeminiTransientRetry(
  fn,
  { attempts = 6, delayMs = 4_000, maxRateLimitDelayMs = 120_000 } = {},
) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientGeminiError(error) || attempt === attempts) throw error;
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          geminiRetryDelayMs(error, attempt, delayMs, maxRateLimitDelayMs),
        ),
      );
    }
  }
  throw lastError ?? new Error("Gemini transient retry exhausted.");
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
  const auditOnly =
    modelEnvKeys.length > 0 &&
    modelEnvKeys.every((key) => key === "GEMINI_AUDIT_MODEL" || key.startsWith("GEMINI_AUDIT"));
  if (auditOnly || modelEnvKeys.includes("GEMINI_AUDIT_MODEL")) {
    return DEFAULT_GEMINI_AUDIT_MODEL;
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

  const ingestRetry = resolveGeminiIngestRetryOptions();
  const res = await withGeminiTransientRetry(async () => {
    const response = await fetchWithRetry(
      endpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      { attempts: ingestRetry.fetchAttempts, delayMs: 2_500, timeoutMs },
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Gemini ${errorLabel} extraction failed (${response.status}): ${detail.slice(0, 300)}`,
      );
    }
    return response;
  }, ingestRetry);

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
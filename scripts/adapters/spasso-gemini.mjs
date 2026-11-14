import { fetchWithRetry } from "./http.mjs";
import { geminiExtractionEnabled } from "./corso-gemini.mjs";

export { geminiExtractionEnabled };

const USER_AGENT = "FeiraBoaOfferIngest/1.0 (official public flyer extraction)";
const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

const CAMPAIGN_SCHEMA = `{
  "campaigns": [
    {
      "from": "YYYY-MM-DD",
      "to": "YYYY-MM-DD",
      "offers": [
        {
          "name": "product name without brand",
          "brand": "brand or empty string",
          "detail": "Unidade|Kg|500g|1L etc",
          "cat": "Hortifruti|Mercearia|Laticínios|Limpeza|Bebidas|Carnes|Congelados|Peixes|Frios|Geral",
          "price": 0.0,
          "oldPrice": 0.0 or null
        }
      ]
    }
  ]
}`;

function geminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || "";
}

async function downloadBase64(url) {
  const res = await fetchWithRetry(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Could not download Spasso flyer image (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  return { mime, data: buffer.toString("base64") };
}

export async function extractSpassoCampaignsViaGemini(imageUrls) {
  const key = geminiApiKey();
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set; cannot run Spasso vision extraction.");
  }
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    throw new Error("Spasso Gemini extraction requires at least one flyer image URL.");
  }

  const images = await Promise.all(imageUrls.map((url) => downloadBase64(url)));
  const prompt = [
    "You transcribe official Brazilian supermarket flyer images into structured JSON.",
    "These images are Spasso Sabores encarte pages (hortifruti, açougue, mercearia, etc.).",
    "Read every flyer image. Extract each priced product offer you can read clearly.",
    "Use Brazilian decimal prices as numbers (4,18 => 4.18).",
    "Keep separate campaign windows when validity dates differ between encarte sections.",
    "Never invent offers; omit unreadable cells.",
    "Return ONLY JSON matching this schema:",
    CAMPAIGN_SCHEMA,
  ].join("\n");

  const model =
    process.env.SPASSO_GEMINI_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_GEMINI_MODEL;
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
    { attempts: 5, delayMs: 2_000, timeoutMs: 180_000 },
  );
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini Spasso extraction failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const payload = await res.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text).join("") ?? "";
  if (!text.trim()) throw new Error("Gemini Spasso extraction returned empty content.");

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini Spasso extraction did not return valid JSON.");
  }

  if (!Array.isArray(parsed.campaigns)) {
    throw new Error("Gemini Spasso extraction JSON is missing campaigns[].");
  }
  return parsed.campaigns;
}

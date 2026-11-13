import { fetchWithRetry } from "./http.mjs";

const USER_AGENT = "FeiraBoaOfferIngest/1.0 (official public flyer extraction)";

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
          "cat": "Hortifruti|Mercearia|Laticínios|Limpeza|Bebidas|Carnes|Congelados|Geral",
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
  if (!res.ok) throw new Error(`Could not download Corso flyer image (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  return { mime, data: buffer.toString("base64") };
}

export function geminiExtractionEnabled() {
  return geminiApiKey().length > 0;
}

export async function extractCorsoCampaignsViaGemini({ frenteUrl, versoUrl }) {
  const key = geminiApiKey();
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set; cannot run Corso vision extraction.");
  }

  const [frente, verso] = await Promise.all([downloadBase64(frenteUrl), downloadBase64(versoUrl)]);
  const prompt = [
    "You transcribe official Brazilian supermarket flyer images into structured JSON.",
    "Read both flyer pages (frente and verso). Extract every priced offer.",
    "Use Brazilian decimal prices as numbers (4,18 => 4.18).",
    "Keep separate campaign windows when validity dates differ on the flyer.",
    "Never invent offers; omit unreadable cells.",
    "Return ONLY JSON matching this schema:",
    CAMPAIGN_SCHEMA,
  ].join("\n");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inline_data: { mime_type: frente.mime, data: frente.data } },
          { inline_data: { mime_type: verso.mime, data: verso.data } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini Corso extraction failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const payload = await res.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text).join("") ?? "";
  if (!text.trim()) throw new Error("Gemini Corso extraction returned empty content.");

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini Corso extraction did not return valid JSON.");
  }

  if (!Array.isArray(parsed.campaigns)) {
    throw new Error("Gemini Corso extraction JSON is missing campaigns[].");
  }
  return parsed.campaigns;
}

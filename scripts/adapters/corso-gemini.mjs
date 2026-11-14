import {
  campaignSchemaJson,
  downloadFlyerImageBase64,
  geminiExtractionEnabled,
  generateFlyerCampaignsViaGemini,
} from "./gemini-flyer.mjs";

export { geminiExtractionEnabled };

const CORSO_SCHEMA = campaignSchemaJson();

export async function extractCorsoCampaignsViaGemini({ frenteUrl, versoUrl }) {
  const [frente, verso] = await Promise.all([
    downloadFlyerImageBase64(frenteUrl, { label: "Corso flyer", defaultMime: "image/jpeg" }),
    downloadFlyerImageBase64(versoUrl, { label: "Corso flyer", defaultMime: "image/jpeg" }),
  ]);

  const prompt = [
    "You transcribe official Brazilian supermarket flyer images into structured JSON.",
    "Read both flyer pages (frente and verso). Extract every priced offer.",
    "Use Brazilian decimal prices as numbers (4,18 => 4.18).",
    "Keep separate campaign windows when validity dates differ on the flyer.",
    "Never invent offers; omit unreadable cells.",
    "Return ONLY JSON matching this schema:",
    CORSO_SCHEMA,
  ].join("\n");

  return generateFlyerCampaignsViaGemini({
    prompt,
    images: [frente, verso],
    modelEnvKeys: ["CORSO_GEMINI_MODEL", "GEMINI_MODEL"],
    errorLabel: "Corso",
    timeoutMs: 120_000,
  });
}
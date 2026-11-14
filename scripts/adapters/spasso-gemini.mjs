import {
  campaignSchemaJson,
  downloadFlyerImageBase64,
  geminiExtractionEnabled,
  generateFlyerCampaignsViaGemini,
} from "./gemini-flyer.mjs";

export { geminiExtractionEnabled };

const SPASSO_SCHEMA = campaignSchemaJson(["Peixes", "Frios"]);

export async function extractSpassoCampaignsViaGemini(imageUrls) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    throw new Error("Spasso Gemini extraction requires at least one flyer image URL.");
  }

  const images = await Promise.all(
    imageUrls.map((url) => downloadFlyerImageBase64(url, { label: "Spasso flyer", defaultMime: "image/png" })),
  );

  const prompt = [
    "You transcribe official Brazilian supermarket flyer images into structured JSON.",
    "These images are Spasso Sabores encarte pages (hortifruti, açougue, mercearia, etc.).",
    "Read every flyer image. Extract each priced product offer you can read clearly.",
    "Use Brazilian decimal prices as numbers (4,18 => 4.18).",
    "Keep separate campaign windows when validity dates differ between encarte sections.",
    "Never invent offers; omit unreadable cells.",
    "Return ONLY JSON matching this schema:",
    SPASSO_SCHEMA,
  ].join("\n");

  return generateFlyerCampaignsViaGemini({
    prompt,
    images,
    modelEnvKeys: ["SPASSO_GEMINI_MODEL", "GEMINI_MODEL"],
    errorLabel: "Spasso",
    timeoutMs: 180_000,
  });
}
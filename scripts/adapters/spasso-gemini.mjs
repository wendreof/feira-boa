import {
  campaignSchemaJson,
  downloadFlyerImageBase64,
  geminiExtractionEnabled,
  geminiIngestFastFailEnabled,
  generateFlyerCampaignsViaGemini,
} from "./gemini-flyer.mjs";

export { geminiExtractionEnabled };

const SPASSO_SCHEMA = campaignSchemaJson(["Peixes", "Frios"]);
/** Six full PNG pages exceeded the Gemini request size and failed with `terminated` in CI. */
export const SPASSO_IMAGES_PER_GEMINI_CALL = 2;

/**
 * @param {string[]} imageUrls
 * @param {number} [chunkSize]
 */
export function chunkFlyerImageUrls(imageUrls, chunkSize = SPASSO_IMAGES_PER_GEMINI_CALL) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) return [];
  const size = Math.max(1, chunkSize);
  const chunks = [];
  for (let index = 0; index < imageUrls.length; index += size) {
    chunks.push(imageUrls.slice(index, index + size));
  }
  return chunks;
}

function spassoPrompt(partIndex, partCount) {
  return [
    "You transcribe official Brazilian supermarket flyer images into structured JSON.",
    "These images are Spasso Sabores encarte pages (hortifruti, açougue, mercearia, etc.).",
    `This batch is ${partIndex} of ${partCount} for the same live encarte.`,
    "Read every flyer image in this batch. Extract each priced product offer you can read clearly.",
    "Use Brazilian decimal prices as numbers (4,18 => 4.18).",
    "Keep separate campaign windows when validity dates differ between encarte sections.",
    "When the flyer only shows weekday names (Terça e Quarta, Quarta a Sexta, etc.) without numeric dates, set campaign weekdays as Portuguese day names and leave from/to as best-effort or omit them.",
    "Do not emit section headers (e.g. Terça e Quarta do Hortifruti) as product offers; only priced products.",
    "Never invent offers; omit unreadable cells.",
    "Return ONLY JSON matching this schema:",
    SPASSO_SCHEMA,
  ].join("\n");
}

export async function extractSpassoCampaignsViaGemini(imageUrls) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    throw new Error("Spasso Gemini extraction requires at least one flyer image URL.");
  }

  const batches = chunkFlyerImageUrls(imageUrls);
  const campaigns = [];
  const batchPauseMs = geminiIngestFastFailEnabled() ? 2_000 : 4_000;

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    if (batchIndex > 0) {
      await new Promise((resolve) => setTimeout(resolve, batchPauseMs));
    }
    const urls = batches[batchIndex];
    const images = await Promise.all(
      urls.map((url) => downloadFlyerImageBase64(url, { label: "Spasso flyer", defaultMime: "image/png" })),
    );
    const part = await generateFlyerCampaignsViaGemini({
      prompt: spassoPrompt(batchIndex + 1, batches.length),
      images,
      modelEnvKeys: ["SPASSO_GEMINI_MODEL", "GEMINI_MODEL"],
      errorLabel: "Spasso",
      timeoutMs: geminiIngestFastFailEnabled() ? 90_000 : 180_000,
    });
    campaigns.push(...part);
  }

  return campaigns;
}
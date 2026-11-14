export function loadFlyerCampaignFile(raw) {
  if (Array.isArray(raw)) {
    return { flyerHash: null, extractionMethod: "legacy", campaigns: raw };
  }
  if (raw && Array.isArray(raw.campaigns)) {
    return {
      flyerHash: raw.flyerHash ?? null,
      updatedAt: raw.updatedAt ?? null,
      extractionMethod: raw.extractionMethod ?? "cache",
      campaigns: raw.campaigns,
    };
  }
  return { flyerHash: null, extractionMethod: "unknown", campaigns: [] };
}

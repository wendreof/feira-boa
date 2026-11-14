import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  campaignSchemaJson,
  geminiApiKey,
  geminiExtractionEnabled,
  parseGeminiCampaignsJson,
  resolveGeminiModel,
} from "../scripts/adapters/gemini-flyer.mjs";

describe("gemini-flyer", () => {
  const envKeys = ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GEMINI_MODEL", "CUSTOM_MODEL"];
  /** @type {Record<string, string | undefined>} */
  let savedEnv;

  beforeEach(() => {
    savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    for (const key of envKeys) delete process.env[key];
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  it("campaignSchemaJson merges extra categories", () => {
    const schema = campaignSchemaJson(["Peixes", "Frios"]);
    assert.match(schema, /Peixes\|Frios/);
    assert.match(schema, /Hortifruti/);
  });

  it("geminiApiKey prefers GEMINI_API_KEY", () => {
    process.env.GEMINI_API_KEY = "  test-key  ";
    assert.equal(geminiApiKey(), "test-key");
    assert.equal(geminiExtractionEnabled(), true);
  });

  it("resolveGeminiModel walks env keys then default", () => {
    process.env.CUSTOM_MODEL = "custom";
    assert.equal(resolveGeminiModel(["CUSTOM_MODEL", "GEMINI_MODEL"]), "custom");
    assert.equal(resolveGeminiModel(["MISSING"]), "gemini-3.8-flash");
  });

  it("parseGeminiCampaignsJson validates campaigns array", () => {
    const campaigns = parseGeminiCampaignsJson('{"campaigns":[{"offers":[]}]}', "Test");
    assert.equal(campaigns.length, 1);
    assert.throws(() => parseGeminiCampaignsJson("{}", "Test"), /missing campaigns/);
  });

  it("parseGeminiCampaignsJson repairs malformed JSON from Gemini", () => {
    const malformed = `{
  "campaigns": [
    {
      "from": "2026-01-01",
      "to": "2026-01-07",
      "offers": [],
    },
  ],
}`;
    const campaigns = parseGeminiCampaignsJson(malformed, "Test");
    assert.equal(campaigns.length, 1);
    assert.equal(campaigns[0].from, "2026-01-01");
  });

  it("parseGeminiCampaignsJson rejects unrecoverable JSON", () => {
    assert.throws(() => parseGeminiCampaignsJson("{{{{", "Test"), /valid JSON/);
  });
});
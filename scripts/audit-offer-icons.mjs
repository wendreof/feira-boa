import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pickGeminiReviewCandidates, summarizeIconAudit } from "./domain/icon-audit.mjs";
import { suggestIconsViaGemini } from "./adapters/gemini-icon-audit.mjs";
import { geminiApiKey } from "./adapters/gemini-flyer.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_FEED = join(ROOT, "offers.json");
const DEFAULT_REPORT = join(ROOT, "icon-audit-report.json");
const MAX_REPORT_ROWS = 400;
const DEFAULT_GEMINI_CAP = Number(process.env.ICON_AUDIT_GEMINI_CAP ?? "50");

function readOffers(feedPath) {
  const payload = JSON.parse(readFileSync(feedPath, "utf8"));
  return Array.isArray(payload.offers) ? payload.offers : payload;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const feedPath = process.env.FEED_PATH?.trim() || DEFAULT_FEED;
  const reportPath = process.env.ICON_AUDIT_REPORT?.trim() || DEFAULT_REPORT;
  const withGemini = args.has("--gemini") || process.env.ICON_AUDIT_GEMINI === "1";

  const offers = readOffers(feedPath);
  const audit = summarizeIconAudit(offers);
  const report = {
    ranAt: new Date().toISOString(),
    feedPath,
    geminiEnabled: withGemini && geminiApiKey().length > 0,
    summary: audit.summary,
    issues: audit.rows.slice(0, MAX_REPORT_ROWS),
    issuesTruncated: Math.max(0, audit.rows.length - MAX_REPORT_ROWS),
    gemini: null,
  };

  if (withGemini) {
    const candidates = pickGeminiReviewCandidates(audit.rows, DEFAULT_GEMINI_CAP);
    report.gemini = {
      cap: DEFAULT_GEMINI_CAP,
      candidates: candidates.length,
      ...(await suggestIconsViaGemini(candidates)),
    };
  }

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Wrote ${reportPath}`);
  console.log(
    `Flagged ${audit.summary.flaggedOffers}/${audit.summary.totalOffers} · generic ${audit.summary.genericIcons} · auto-fixable ${audit.summary.autoFixableIssues}`,
  );

  if (audit.summary.autoFixableIssues > 0) {
    console.log("Run: node scripts/apply-icon-audit-fixes.mjs to rebuild icons in offers.json");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
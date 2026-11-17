import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_REPORT = join(ROOT, "icon-audit-report.json");

function main() {
  const reportPath = process.env.ICON_AUDIT_REPORT?.trim() || DEFAULT_REPORT;
  if (!existsSync(reportPath)) {
    console.error(`Missing ${reportPath}. Run: node scripts/audit-offer-icons.mjs`);
    process.exit(1);
  }

  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  const autoFixable = Number(report.summary?.autoFixableIssues ?? 0);
  const geminiDisagreements =
    report.gemini?.suggestions?.filter((item) => !item.agree && item.suggestedIcon !== "🏷️") ?? [];

  if (autoFixable === 0 && geminiDisagreements.length === 0) {
    console.log("No auto-fixable icon drift in feed. Strengthen scripts/domain/icons.mjs rules for generic_icon rows.");
    process.exit(0);
  }

  let rebuilt = false;
  if (autoFixable > 0) {
    console.log(`Rebuilding feed to refresh ${autoFixable} stale/spice icon(s)...`);
    const result = spawnSync(process.execPath, ["scripts/build-offer-feed.mjs"], {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
    rebuilt = true;
  }

  console.log(
    rebuilt
      ? "Feed rebuilt. Re-run audit-offer-icons.mjs to verify."
      : "No feed rebuild needed.",
  );

  if (geminiDisagreements.length > 0) {
    console.log(`Gemini flagged ${geminiDisagreements.length} advisory icon(s) — review before editing icons.mjs:`);
    for (const item of geminiDisagreements.slice(0, 10)) {
      console.log(`- ${item.name}: assign ${item.assigned} → Gemini ${item.suggestedIcon} (${item.rationale})`);
    }
  }
}

main();
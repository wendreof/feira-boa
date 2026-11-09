import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { saoPauloDate } from "./offer-matcher.mjs";
import {
  catalogFeedFingerprint,
  catalogPushAlreadySentToday,
} from "./domain/catalog-feed-fingerprint.mjs";
import {
  buildPushPayload,
  configureVapid,
  pushErrorCode,
  readVapidConfig,
  sendWebPush,
  subscriptionFromRow,
} from "./push-client.mjs";

const PAGE_SIZE = 1000;
const PUSH_SEND_GAP_MS = 25;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readConfig(env) {
  if (!env.SUPABASE_URL?.trim() || !env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  const siteUrl = env.SITE_URL?.trim();
  if (!siteUrl) throw new Error("Missing SITE_URL");
  const parsed = new URL(siteUrl);
  if (parsed.protocol !== "https:") throw new Error("SITE_URL must use HTTPS.");
  const vapid = readVapidConfig(env);
  if (!vapid) throw new Error("VAPID_PRIVATE_KEY is required for catalog push.");
  configureVapid(vapid);
  return { siteUrl: parsed, vapid };
}

async function readRows(queryFactory, orderColumns = ["endpoint"]) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = queryFactory();
    for (const column of orderColumns) query = query.order(column);
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function loadFeed() {
  const feedText = await readFile(new URL("../offers.json", import.meta.url), "utf8");
  return JSON.parse(feedText);
}

function buildCatalogMessage({ activeCount, siteUrl }) {
  const title = "Feira Boa — ofertas de hoje";
  const body = activeCount > 0
    ? `${activeCount} ofertas ativas no catálogo. Confira os preços dos folhetos.`
    : "O catálogo foi atualizado. Confira as ofertas do dia.";
  return {
    title,
    body,
    payload: buildPushPayload({
      title,
      body,
      url: `${siteUrl.origin}/index.html`,
      tag: `feira-catalog-${saoPauloDate()}`,
    }),
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const config = readConfig(process.env);
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const today = saoPauloDate();
  const feed = await loadFeed();
  const fingerprint = catalogFeedFingerprint(feed, today);
  const activeCount = (feed.offers ?? []).filter(
    (offer) => offer.validFrom <= today && offer.validTo >= today,
  ).length;

  const { data: stateRow, error: stateError } = await supabase
    .from("catalog_push_state")
    .select("feed_fingerprint")
    .eq("id", 1)
    .maybeSingle();
  if (stateError) throw stateError;

  if (stateRow?.feed_fingerprint === fingerprint) {
    console.log(JSON.stringify({
      skipped: "feed_unchanged",
      fingerprint,
      activeOffers: activeCount,
      dryRun,
    }));
    return;
  }

  const [anonymousRows, accountRows, pausedProfiles] = await Promise.all([
    readRows(() => supabase.from("anonymous_push_subscriptions").select("endpoint, p256dh, auth_key, last_catalog_push_at")),
    readRows(() => supabase.from("push_subscriptions").select("user_id, endpoint, p256dh, auth_key, last_catalog_push_at")),
    readRows(() => supabase.from("profiles").select("user_id, notifications_paused").eq("notifications_paused", true)),
  ]);
  const pausedUsers = new Set(pausedProfiles.map((row) => row.user_id));
  const endpoints = new Map();

  for (const row of anonymousRows) {
    if (catalogPushAlreadySentToday(row.last_catalog_push_at, today)) continue;
    endpoints.set(row.endpoint, { ...row, source: "anonymous" });
  }
  for (const row of accountRows) {
    if (pausedUsers.has(row.user_id)) continue;
    if (catalogPushAlreadySentToday(row.last_catalog_push_at, today)) continue;
    endpoints.set(row.endpoint, { ...row, source: "account" });
  }

  const message = buildCatalogMessage({ activeCount, siteUrl: config.siteUrl });
  const summary = {
    dryRun,
    fingerprint,
    feedUpdatedAt: feed.updatedAt,
    activeOffers: activeCount,
    candidates: endpoints.size,
    sent: 0,
    failed: 0,
    removed: 0,
  };

  for (const row of endpoints.values()) {
    if (dryRun) {
      summary.sent += 1;
      continue;
    }
    try {
      await sendWebPush(subscriptionFromRow(row), message.payload);
      summary.sent += 1;
      const now = new Date().toISOString();
      if (row.source === "anonymous") {
        await supabase.from("anonymous_push_subscriptions")
          .update({ last_catalog_push_at: now })
          .eq("endpoint", row.endpoint);
      } else {
        await supabase.from("push_subscriptions")
          .update({ last_catalog_push_at: now, last_used_at: now })
          .eq("endpoint", row.endpoint);
      }
    } catch (error) {
      summary.failed += 1;
      const code = pushErrorCode(error);
      if (code === "push_subscription_gone") {
        summary.removed += 1;
        if (row.source === "anonymous") {
          await supabase.from("anonymous_push_subscriptions").delete().eq("endpoint", row.endpoint);
        } else {
          await supabase.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
        }
      }
      console.error(`Catalog push failed for ${row.endpoint}: ${error.message}`);
    }
    await sleep(PUSH_SEND_GAP_MS);
  }

  if (!dryRun && stateRow?.feed_fingerprint !== fingerprint) {
    const { error: updateError } = await supabase.from("catalog_push_state").upsert({
      id: 1,
      feed_fingerprint: fingerprint,
      feed_updated_at: feed.updatedAt,
      updated_at: new Date().toISOString(),
    });
    if (updateError) throw updateError;
  }

  console.log(JSON.stringify(summary));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

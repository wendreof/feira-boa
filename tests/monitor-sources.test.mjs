import test from "node:test";
import assert from "node:assert/strict";
import { monitorSource } from "../scripts/monitor-sources.mjs";
import { getWeekValidity, probePagueMenosCatalog } from "../scripts/adapters/paguemenos.mjs";

const PAGUE_MENOS_SOURCE = {
  url: "https://www.superpaguemenos.com.br/ofertas?productclusterids=161",
  store: "Pague Menos",
  branch: "Loja 33 · Jardim Santo André",
  store_id: "paguemenos",
  store_key: "pague-menos-loja-33-jardim-santo-andre",
};

const FLYER_SOURCE = {
  url: "https://store.example/flyer.pdf",
  store: "Big Bom",
  branch: "Vila Zanetti · São João",
  store_id: "bigbom",
  store_key: "big-bom-vila-zanetti-sao-joao",
};

function currentWeekWindow() {
  const { from, to } = getWeekValidity();
  return `${from}/${to}`;
}

function catalogResponse(count, total) {
  const products = Array.from({ length: count }, (_, index) => ({ productId: String(index) }));
  return new Response(JSON.stringify(products), {
    status: 206,
    headers: { "content-type": "application/json", "resources": `0-${count - 1}/${total}` },
  });
}

function catalogFetch({ count = 50, total = 1039 } = {}) {
  return async () => catalogResponse(count, total);
}

test("live catalog probe keeps a reviewed source reviewed across daily churn", async () => {
  const previous = {
    ...PAGUE_MENOS_SOURCE,
    week_window: currentWeekWindow(),
    catalog_total: 1039,
    needs_review: false,
    last_success_at: "2026-10-22T17:00:00.000Z",
  };
  const [entry, changed] = await monitorSource(PAGUE_MENOS_SOURCE, previous, catalogFetch({ total: 1011 }));
  assert.equal(entry.needs_review, false);
  assert.equal(entry.catalog_total, 1011);
  assert.equal(entry.week_window, currentWeekWindow());
  assert.equal(entry.last_error, null);
  assert.ok(Date.parse(entry.last_success_at) > Date.parse(previous.last_success_at));
  assert.equal(changed, false);
});

test("live catalog probe flags the source when the weekly campaign window rotates", async () => {
  const previous = {
    ...PAGUE_MENOS_SOURCE,
    week_window: "2020-01-01/2020-01-05",
    catalog_total: 1039,
    needs_review: false,
    last_success_at: "2026-10-22T17:00:00.000Z",
  };
  const [entry, changed] = await monitorSource(PAGUE_MENOS_SOURCE, previous, catalogFetch());
  assert.equal(entry.needs_review, true);
  assert.equal(entry.week_window, currentWeekWindow());
  assert.equal(changed, true);
});

test("live catalog probe failure preserves review state and records the error", async () => {
  const previous = {
    ...PAGUE_MENOS_SOURCE,
    week_window: currentWeekWindow(),
    catalog_total: 1039,
    needs_review: false,
    last_success_at: "2026-10-22T17:00:00.000Z",
  };
  const failingFetch = async () => { throw new Error("boom"); };
  const [entry, changed] = await monitorSource(PAGUE_MENOS_SOURCE, previous, failingFetch);
  assert.equal(entry.needs_review, false);
  assert.equal(entry.last_error, "Error");
  assert.equal(entry.last_success_at, previous.last_success_at);
  assert.equal(entry.week_window, previous.week_window);
  assert.equal(changed, false);
});

test("a brand-new live catalog source starts under review", async () => {
  const [entry] = await monitorSource(PAGUE_MENOS_SOURCE, null, catalogFetch());
  assert.equal(entry.needs_review, true);
  assert.equal(entry.catalog_total, 1039);
});

test("catalog probe rejects empty or failed responses", async () => {
  await assert.rejects(() => probePagueMenosCatalog(async () => new Response("[]", { status: 200 })), /no products/);
  await assert.rejects(() => probePagueMenosCatalog(async () => new Response("oops", { status: 500 })), /probe failed/);
  await assert.rejects(() => probePagueMenosCatalog(async () => new Response("[]", { status: 206, headers: { resources: "0-49/0" } })), /no products/);
});

test("content-hash sources still flag page changes and clear on identical content", async () => {
  const body = "official flyer bytes";
  const otherBody = "official flyer bytes, new campaign";
  const fetchFor = (text) => async () => new Response(text, { status: 200 });
  const fresh = await monitorSource(FLYER_SOURCE, null, fetchFor(body));
  assert.equal(fresh[0].needs_review, true);
  assert.equal(fresh[0].sha256.length, 64);

  const reviewed = { ...fresh[0], needs_review: false };
  const [unchanged] = await monitorSource(FLYER_SOURCE, reviewed, fetchFor(body));
  assert.equal(unchanged.needs_review, false);

  const [changedEntry] = await monitorSource(FLYER_SOURCE, reviewed, fetchFor(otherBody));
  assert.equal(changedEntry.needs_review, true);
});

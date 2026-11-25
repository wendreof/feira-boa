import assert from "node:assert/strict";
import test from "node:test";
import { extractSpani, SPANI_PAGE_SAFETY_CAP } from "../scripts/adapters/spani.mjs";

function spaniOfferProduct(produtoId) {
  return {
    produto_id: produtoId,
    descricao: `Produto Promo ${produtoId}`,
    disponivel: true,
    em_oferta: true,
    unidade_sigla: "UN",
    secao_id: 129,
    preco: "12.00",
    oferta: { menor_preco: "9.99", preco_antigo: "12.00" },
  };
}

function buildOffersPage(page, { totalPages, itemCount = 20 }) {
  const products = Array.from({ length: itemCount }, (_, index) => spaniOfferProduct(page * 100 + index));
  return {
    success: true,
    data: products,
    paginator: { total_pages: totalPages, total_items: totalPages * itemCount },
  };
}

function mockSpaniFetch(pagesByNumber) {
  return async (url, init = {}) => {
    if (url.includes("/auth/loja/login") && init.method === "POST") {
      return new Response(JSON.stringify({ data: "spani-test-token" }), { status: 200 });
    }
    if (url.includes("/loja/sessao_cliente")) {
      return new Response(JSON.stringify({ data: { sessao_id: "spani-sessao" } }), { status: 200 });
    }
    if (url.includes("/produtos/em-oferta")) {
      const match = url.match(/[?&]page=(\d+)/);
      const page = Number(match?.[1] ?? 1);
      const body = pagesByNumber[page] ?? buildOffersPage(page, { totalPages: 1, itemCount: 0 });
      return new Response(JSON.stringify(body), { status: 200 });
    }
    return new Response(`unexpected url ${url}`, { status: 404 });
  };
}

test("SPANI_PAGE_SAFETY_CAP leaves headroom beyond observed VIP catalog depth", () => {
  assert.equal(SPANI_PAGE_SAFETY_CAP, 250);
});

test("extractSpani walks paginator total_pages until the last page", async () => {
  const originalFetch = globalThis.fetch;
  let offerFetches = 0;
  globalThis.fetch = async (url, init) => {
    const impl = mockSpaniFetch({
      1: buildOffersPage(1, { totalPages: 2 }),
      2: buildOffersPage(2, { totalPages: 2, itemCount: 5 }),
    });
    const response = await impl(url, init);
    if (url.includes("/produtos/em-oferta")) offerFetches += 1;
    return response;
  };
  try {
    const snapshot = await extractSpani();
    assert.equal(snapshot.storeId, "spani");
    assert.equal(snapshot.status, "ok");
    assert.equal(offerFetches, 2);
    assert.equal(snapshot.offers.length, 25);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
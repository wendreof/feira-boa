import assert from "node:assert/strict";
import test from "node:test";
import { presentationViolations } from "../scripts/offer-name-guard.mjs";
import { normalizeOfferPresentation } from "../scripts/domain/presentation.mjs";

test("presentationViolations flags every known flyer-junk class", () => {
  const cases = [
    { name: "Ofertas válidas de quinta a domingo, 22 a 25/10/2026 ou enquanto durarem nossos estoques. LEITE UHT", detail: "1L", note: "" },
    { name: "APARTIR DE UNIDADES PAGUE: 2 PÃO DE FORMA", detail: "390G", note: "" },
    { name: "PAPEL HIGIÊNICO FOLHA DUPLA 30M", detail: "LV12 PG11", note: "" },
    { name: "PAPEL HIGIÊNICO FOLHA DUPLA ABSOLUTE 30M", detail: "Leve 12un Pague 11un", note: "" },
    { name: "Maionese Light Leve 600g Pague", detail: "500g", note: "" },
    { name: "a Mais COMPRE 2 UNIDS. E GANHE GUARANÁ ANTÁRCTICA 2L 1 Macarrão", detail: "65/72g", note: "" },
    { name: "LIMPEZA E PERFUMARIA BAZAR DETERGENTE", detail: "500ML", note: "" },
    { name: "□ VINHO CHILENO", detail: "750ML", note: "" },
    { name: "Arroz Tipo 1", detail: "5KG", note: "Limite por cliente— —UN" },
  ];
  for (const offer of cases) {
    assert.ok(presentationViolations(offer).length > 0, `expected violations for ${JSON.stringify(offer)}`);
  }
});

test("presentationViolations passes cleaned offers", () => {
  assert.deepEqual(presentationViolations({
    name: "Leite Uht Lider Gfa",
    detail: "1L",
    note: "Limite de 6 unidades por cliente · Leve 12 e pague 11",
  }), []);
});

test("cleaned flyer offers satisfy the presentation guard", () => {
  const dirtyOffers = [
    { name: "Ofertas especiais deste box válidas para sexta e sábado, 23 e 24/10/2026 Ofertas válidas de quinta a domingo, 22 a 25/10/2026 ou enquanto durarem nossos estoques. LEITE UHT LIDER GFA", brand: "", detail: "1L", note: "" },
    { name: "APARTIR DE UNIDADES PAGUE: 3 FILTRO DE PAPEL 3 CORAÇÕES 103 30UN", brand: "", detail: "Unidade", note: "" },
    { name: "LIMPEZA E PERFUMARIA BAZAR MATINAIS RESFRIADOS MACARRÃO C/ OVOS RENATA", brand: "", detail: "500G", note: "" },
    { name: "□ VINHO CHILENO CHILANO", brand: "", detail: "750ML", note: "Limite por cliente— —UN" },
    { name: "PAPEL HIGIÊNICO FOLHA DUPLA 30M MIMMO", brand: "", detail: "LV12 PG11", note: "" },
    { name: "Papel Higiênico Folha Dupla Absolute 30m", brand: "", detail: "Leve 12un Pague 11un", note: "" },
    { name: "Maionese Light Leve 600g Pague", brand: "", detail: "500g", note: "" },
    { name: "a Mais COMPRE 2 UNIDS. E GANHE GUARANÁ ANTÁRCTICA 2L 1 Macarrão Instantâneo CUP NOODLES", brand: "", detail: "65/72g", note: "" },
  ];
  for (const source of dirtyOffers) {
    const cleaned = normalizeOfferPresentation(source);
    if (!cleaned.name) continue;
    assert.deepEqual(presentationViolations(cleaned), [], `guard must pass for ${cleaned.name}`);
  }
});

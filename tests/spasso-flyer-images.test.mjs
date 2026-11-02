import { test } from "node:test";
import assert from "node:assert/strict";
import { filterSpassoFlyerImages, isSpassoFlyerImage, labelSpassoFlyerImage } from "../scripts/adapters/spasso-flyer-images.mjs";

test("drops Spasso logos and keeps dated flyer PNGs", () => {
  const urls = [
    "https://spassosabores.com.br/wp-content/uploads/2020/12/cropped-logo-site-spasso-sabores.png",
    "https://spassosabores.com.br/wp-content/uploads/2026/10/FLV-SPASSO-1.png",
    "https://spassosabores.com.br/wp-content/uploads/2026/10/ACOUGUE-SPASSO-1.png",
    "https://spassosabores.com.br/wp-content/uploads/2026/10/FLV-SPASSO-1.png",
  ];
  assert.deepEqual(filterSpassoFlyerImages(urls), [
    "https://spassosabores.com.br/wp-content/uploads/2026/10/FLV-SPASSO-1.png",
    "https://spassosabores.com.br/wp-content/uploads/2026/10/ACOUGUE-SPASSO-1.png",
  ]);
  const mixedMonths = [
    "https://spassosabores.com.br/wp-content/uploads/2026/08/FLV-SPASSO-1.png",
    "https://spassosabores.com.br/wp-content/uploads/2026/10/FLV-SPASSO-1.png",
    "https://spassosabores.com.br/wp-content/uploads/2026/10/ACOUGUE-SPASSO-1.png",
    "https://spassosabores.com.br/wp-content/uploads/2026/10/SPASSO-1-5.png",
    "https://spassosabores.com.br/wp-content/uploads/2021/08/google-play.png",
  ];
  assert.deepEqual(filterSpassoFlyerImages(mixedMonths), [
    "https://spassosabores.com.br/wp-content/uploads/2026/10/FLV-SPASSO-1.png",
    "https://spassosabores.com.br/wp-content/uploads/2026/10/ACOUGUE-SPASSO-1.png",
    "https://spassosabores.com.br/wp-content/uploads/2026/10/SPASSO-1-5.png",
  ]);
  assert.equal(isSpassoFlyerImage(urls[0]), false);
  assert.equal(labelSpassoFlyerImage(urls[1]), "Hortifruti");
  assert.equal(labelSpassoFlyerImage(urls[2]), "Açougue");
});

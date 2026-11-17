import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('christmas icon pipeline', () => {
  it('build-icons skips Christmas SVG render by default', async () => {
    const src = await readFile(new URL('../scripts/build-icons.mjs', import.meta.url), 'utf8');
    assert.match(src, /--include-christmas-svg/);
    assert.match(src, /export-christmas-icons-from-reference/);
    assert.match(src, /includeChristmasSvg/);
  });

  it('keeps reference masters and exported christmas PNGs', async () => {
    const masters = [
      'icons/source/christmas/reference-sheet-20261117.png',
      'icons/source/christmas/master-plain-square-green.png',
      'icons/source/christmas/master-maskable-squircle.png',
      'icons/source/christmas/master-push-rounded.png',
    ];
    for (const rel of masters) {
      const info = await stat(new URL(`../${rel}`, import.meta.url));
      assert.ok(info.size > 500, `${rel} should exist and be non-trivial`);
    }
    const outputs = [
      'icons/icon-christmas-192.png',
      'icons/icon-christmas-512.png',
      'icons/icon-christmas-1024.png',
      'icons/maskable-christmas-512.png',
      'icons/notification-christmas-96.png',
      'icons/badge-christmas-72.png',
    ];
    for (const rel of outputs) {
      const info = await stat(new URL(`../${rel}`, import.meta.url));
      assert.ok(info.size > 2000, `${rel} should exist`);
    }
  });
});
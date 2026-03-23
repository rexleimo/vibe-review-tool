import test from "node:test";
import assert from "node:assert/strict";
import { brand } from "../src/content/brand.ts";
import { siteCopy } from "../src/content/siteCopy.ts";

test("site copy contains both locales with matching page keys", () => {
  assert.deepEqual(Object.keys(siteCopy.en), Object.keys(siteCopy.zh));
});

test("brand strings stay centralized", () => {
  assert.ok(brand.productName.length > 0);
  assert.ok(brand.tagline.en.length > 0);
});

test("home copy includes workflow steps for both locales", () => {
  assert.equal(siteCopy.en.home.workflow.steps.length, 4);
  assert.equal(siteCopy.zh.home.workflow.steps.length, 4);
});

test("home copy names supported AI clients", () => {
  assert.deepEqual(siteCopy.en.home.aiClients, ["Codex", "Claude", "Gemini"]);
});

test("home preview defines screenshot alt text for both locales", () => {
  assert.ok(siteCopy.en.home.preview.imageAlt.length > 0);
  assert.ok(siteCopy.zh.home.preview.imageAlt.length > 0);
});

test("download copy defines macOS, Windows, and Linux labels in both locales", () => {
  assert.equal(siteCopy.en.download.platforms.length, 3);
  assert.equal(siteCopy.zh.download.platforms.length, 3);
});

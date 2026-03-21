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

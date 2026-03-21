import test from "node:test";
import assert from "node:assert/strict";
import { resolveLocaleFromPath } from "../src/lib/locale.ts";

test("resolveLocaleFromPath defaults English for /", () => {
  assert.equal(resolveLocaleFromPath("/"), "en");
});

test("resolveLocaleFromPath returns zh for /zh/download", () => {
  assert.equal(resolveLocaleFromPath("/zh/download"), "zh");
});

import test from "node:test";
import assert from "node:assert/strict";
import { buildLocalePath, publicRoutePaths } from "../src/lib/routes.ts";

test("buildLocalePath maps download route in Chinese", () => {
  assert.equal(buildLocalePath({ locale: "zh", page: "download" }), "/zh/download");
});

test("route table includes four public localized routes", () => {
  assert.deepEqual(publicRoutePaths, ["/", "/download", "/zh", "/zh/download"]);
});

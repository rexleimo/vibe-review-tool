import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.join(__dirname, "..", "package.json");

test("site scaffold package metadata exists", () => {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  assert.equal(packageJson.name, "signal-desk-site");
  assert.equal(packageJson.scripts.build, "tsc && vite build");
});

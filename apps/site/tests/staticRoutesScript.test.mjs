import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, "..", "scripts", "export-static-routes.mjs");

test("static route export script covers localized public paths for GitHub Pages", () => {
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /"\/download"/);
  assert.match(source, /"\/zh"/);
  assert.match(source, /"\/zh\/download"/);
  assert.match(source, /404\.html/);
});

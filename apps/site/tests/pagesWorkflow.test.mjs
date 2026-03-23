import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowPath = path.join(__dirname, "..", "..", "..", ".github", "workflows", "deploy-site-pages.yml");

test("github pages workflow publishes the site from main", () => {
  const source = readFileSync(workflowPath, "utf8");

  assert.match(source, /name:\s*deploy-site-pages/);
  assert.match(source, /workflow_dispatch:/);
  assert.match(source, /branches:\s*\n\s*-\s*main/);
  assert.match(source, /working-directory:\s*apps\/site/);
  assert.match(source, /actions\/configure-pages@v5/);
  assert.match(source, /actions\/upload-pages-artifact@v4/);
  assert.match(source, /actions\/deploy-pages@v4/);
});

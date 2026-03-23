import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const homePagePath = path.join(__dirname, "..", "src", "pages", "HomePage.tsx");

test("home page wires the real desktop screenshot into the hero preview", () => {
  const source = readFileSync(homePagePath, "utf8");

  assert.match(source, /review-editor-shot\.png/);
  assert.match(source, /<img[\s\S]*src=\{reviewEditorShot\}/);
  assert.match(source, /copy\.preview\.imageAlt/);
});

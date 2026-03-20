import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const workflowPath = path.join(repoRoot, ".github/workflows/release-desktop.yml");
const workflow = readFileSync(workflowPath, "utf8");

const matrixPlatforms = Array.from(
  workflow.matchAll(/- platform: ([^\n]+)/g),
  (match) => match[1].trim(),
);

test("release workflow publishes installers for all desktop platforms", () => {
  assert.deepEqual(matrixPlatforms, [
    "ubuntu-22.04",
    "windows-latest",
    "macos-15-intel",
    "macos-14",
  ]);
});

test("release workflow does not reference deprecated or unsupported macOS runners", () => {
  assert.ok(!workflow.includes("macos-13"));
});

test("release workflow forces tauri-action to use npm", () => {
  assert.match(workflow, /tauriScript:\s*npm run tauri/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tauriDir = path.resolve(__dirname, "../src-tauri");

function read(relativePath) {
  return readFileSync(path.join(tauriDir, relativePath), "utf8");
}

test("tauri desktop app registers the store plugin and grants default permission", () => {
  const cargoToml = read("Cargo.toml");
  const rustEntry = read("src/lib.rs");
  const defaultCapability = read("capabilities/default.json");

  assert.match(cargoToml, /^tauri-plugin-store\s*=\s*"2"$/m);
  assert.match(rustEntry, /\.plugin\(tauri_plugin_store::Builder::default\(\)\.build\(\)\)/);
  assert.match(defaultCapability, /"store:default"/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  readCargoVersion,
  readPackageVersion,
  readTauriVersion,
  resolveReleaseNotesPath,
  validateReleaseVersion,
} from "../scripts/assert-release-version.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const tauriConfigPath = path.join(repoRoot, "apps/desktop/src-tauri/tauri.conf.json");
const releaseNotesDir = path.join(repoRoot, ".github/release-notes");

test("readTauriVersion reads the desktop app version from tauri.conf.json", () => {
  assert.equal(readTauriVersion(tauriConfigPath), "0.1.0");
});

test("readPackageVersion and readCargoVersion read the desktop app version metadata", () => {
  assert.equal(readPackageVersion(path.join(repoRoot, "apps/desktop/package.json")), "0.1.0");
  assert.equal(readCargoVersion(path.join(repoRoot, "apps/desktop/src-tauri/Cargo.toml")), "0.1.0");
});

test("resolveReleaseNotesPath maps a version tag to the tracked release notes file", () => {
  assert.equal(
    resolveReleaseNotesPath({ releaseNotesDir, tagName: "v0.1.0" }),
    path.join(releaseNotesDir, "desktop-v0.1.0.md"),
  );
});

test("validateReleaseVersion rejects tags without the v prefix", () => {
  assert.throws(
    () => validateReleaseVersion({ tagName: "0.1.0", tauriConfigPath, releaseNotesDir }),
    /must start with v/i,
  );
});

test("validateReleaseVersion rejects tags that do not match tauri.conf.json", () => {
  assert.throws(
    () => validateReleaseVersion({ tagName: "v0.1.1", tauriConfigPath, releaseNotesDir }),
    /does not match app version 0\.1\.0/i,
  );
});

test("validateReleaseVersion requires a tracked release notes file for the tag", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "release-notes-"));

  try {
    assert.throws(
      () =>
        validateReleaseVersion({
          tagName: "v0.1.0",
          tauriConfigPath,
          releaseNotesDir: tempDir,
        }),
      /release notes file is missing/i,
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("validateReleaseVersion returns normalized release metadata when inputs are valid", () => {
  assert.deepEqual(
    validateReleaseVersion({ tagName: "v0.1.0", tauriConfigPath, releaseNotesDir }),
    {
      tagName: "v0.1.0",
      version: "0.1.0",
      releaseNotesPath: path.join(releaseNotesDir, "desktop-v0.1.0.md"),
    },
  );
});

test("validateReleaseVersion rejects mismatched package.json and Cargo.toml versions", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "release-version-"));

  try {
    const tauriConfig = path.join(tempDir, "tauri.conf.json");
    const packageJson = path.join(tempDir, "package.json");
    const cargoToml = path.join(tempDir, "Cargo.toml");

    writeFileSync(tauriConfig, JSON.stringify({ version: "1.2.3" }, null, 2));
    writeFileSync(packageJson, JSON.stringify({ version: "1.2.4" }, null, 2));
    writeFileSync(
      cargoToml,
      [
        "[package]",
        'name = "review_editor_desktop"',
        'version = "1.2.3"',
      ].join("\n"),
    );

    assert.throws(
      () =>
        validateReleaseVersion({
          tagName: "v1.2.3",
          tauriConfigPath: tauriConfig,
          packageJsonPath: packageJson,
          cargoTomlPath: cargoToml,
          releaseNotesDir,
          skipReleaseNotesCheck: true,
        }),
      /package\.json version 1\.2\.4 does not match tauri version 1\.2\.3/i,
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

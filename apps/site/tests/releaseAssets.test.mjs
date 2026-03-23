import test from "node:test";
import assert from "node:assert/strict";
import { formatReleaseAssetLabel } from "../src/lib/formatting.ts";
import { classifyReleaseAssets } from "../src/lib/releaseAssets.ts";

test("classifyReleaseAssets groups macOS, Windows, and Linux downloads", () => {
  const assets = [
    { name: "Review.Editor_0.1.0_aarch64.dmg", browser_download_url: "https://example.test/a.dmg" },
    { name: "Review.Editor_0.1.0_x64-setup.exe", browser_download_url: "https://example.test/w.exe" },
    { name: "Review.Editor_0.1.0_amd64.AppImage", browser_download_url: "https://example.test/l.appimage" },
  ];

  const result = classifyReleaseAssets(assets);

  assert.equal(result.macos.primary?.label, "macOS (Apple Silicon)");
  assert.equal(result.windows.primary?.label, "Windows Installer");
  assert.equal(result.linux.primary?.label, "Linux AppImage");
});

test("tar.gz app archives are advanced downloads, not primary CTA assets", () => {
  const result = classifyReleaseAssets([
    { name: "Review.Editor_x64.app.tar.gz", browser_download_url: "https://example.test/archive" },
  ]);

  assert.equal(result.macos.primary, null);
  assert.equal(result.macos.advanced.length, 1);
  assert.equal(result.macos.advanced[0].label, "macOS App Archive (Intel)");
});

test("classifyReleaseAssets deterministically classifies the real v0.1.0 asset names", () => {
  const assets = [
    { name: "Review.Editor-0.1.0-1.x86_64.rpm", browser_download_url: "https://example.test/linux.rpm" },
    { name: "Review.Editor_0.1.0_aarch64.dmg", browser_download_url: "https://example.test/macos-arm.dmg" },
    { name: "Review.Editor_0.1.0_amd64.AppImage", browser_download_url: "https://example.test/linux.appimage" },
    { name: "Review.Editor_0.1.0_amd64.deb", browser_download_url: "https://example.test/linux.deb" },
    { name: "Review.Editor_0.1.0_x64-setup.exe", browser_download_url: "https://example.test/windows.exe" },
    { name: "Review.Editor_0.1.0_x64.dmg", browser_download_url: "https://example.test/macos-intel.dmg" },
    { name: "Review.Editor_0.1.0_x64_en-US.msi", browser_download_url: "https://example.test/windows.msi" },
    { name: "Review.Editor_aarch64.app.tar.gz", browser_download_url: "https://example.test/macos-arm.tar.gz" },
    { name: "Review.Editor_x64.app.tar.gz", browser_download_url: "https://example.test/macos-intel.tar.gz" },
  ];

  const result = classifyReleaseAssets(assets);

  assert.equal(result.macos.primary?.label, "macOS (Apple Silicon)");
  assert.deepEqual(result.macos.alternates.map((asset) => asset.label), ["macOS (Intel)"]);
  assert.deepEqual(result.macos.advanced.map((asset) => asset.label), [
    "macOS App Archive (Apple Silicon)",
    "macOS App Archive (Intel)",
  ]);

  assert.equal(result.windows.primary?.label, "Windows Installer");
  assert.deepEqual(result.windows.alternates.map((asset) => asset.label), ["Windows MSI"]);

  assert.equal(result.linux.primary?.label, "Linux AppImage");
  assert.deepEqual(result.linux.alternates.map((asset) => asset.label), [
    "Linux DEB Package",
    "Linux RPM Package",
  ]);
});

test("formatReleaseAssetLabel normalizes user-facing labels instead of leaking filenames", () => {
  assert.equal(
    formatReleaseAssetLabel({ platform: "macos", kind: "dmg", architecture: "arm64" }),
    "macOS (Apple Silicon)",
  );
  assert.equal(
    formatReleaseAssetLabel({ platform: "macos", kind: "app-tar-gz", architecture: "x64" }),
    "macOS App Archive (Intel)",
  );
  assert.equal(
    formatReleaseAssetLabel({ platform: "linux", kind: "rpm", architecture: "x64" }),
    "Linux RPM Package",
  );
});

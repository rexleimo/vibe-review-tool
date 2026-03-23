import test from "node:test";
import assert from "node:assert/strict";
import {
  bundledLatestRelease,
  fetchLatestRelease,
  githubLatestReleaseApiUrl,
  githubReleasesPageUrl,
  latestReleaseCacheKey,
  mapLatestReleasePayload,
  readLatestReleaseCache,
  resolveFallbackLatestRelease,
  writeLatestReleaseCache,
} from "../src/lib/githubRelease.ts";

const fixturePayload = {
  tag_name: "v0.1.0",
  name: "Review Editor v0.1.0",
  html_url: "https://github.com/rexleimo/vibe-review-tool/releases/tag/v0.1.0",
  published_at: "2026-03-20T07:39:00Z",
  assets: [
    {
      name: "Review.Editor_0.1.0_aarch64.dmg",
      browser_download_url: "https://example.test/aarch64.dmg",
      content_type: "application/x-apple-diskimage",
      size: 1024,
    },
    {
      name: "Review.Editor_0.1.0_x64-setup.exe",
      browser_download_url: "https://example.test/x64-setup.exe",
      content_type: "application/vnd.microsoft.portable-executable",
      size: 2048,
    },
  ],
};

function createMemoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

test("mapLatestReleasePayload extracts version, release url, and assets", () => {
  const result = mapLatestReleasePayload(fixturePayload);

  assert.equal(result.tagName, "v0.1.0");
  assert.equal(result.version, "0.1.0");
  assert.equal(result.name, "Review Editor v0.1.0");
  assert.equal(result.releaseUrl, fixturePayload.html_url);
  assert.equal(result.publishedAt, fixturePayload.published_at);
  assert.equal(result.assets.length, 2);
  assert.deepEqual(result.assets[0], {
    name: "Review.Editor_0.1.0_aarch64.dmg",
    downloadUrl: "https://example.test/aarch64.dmg",
    contentType: "application/x-apple-diskimage",
    size: 1024,
  });
});

test("mapLatestReleasePayload rejects malformed GitHub payloads", () => {
  assert.throws(() => mapLatestReleasePayload({}), /assets/i);
});

test("fetchLatestRelease maps a successful latest release response", async () => {
  let receivedUrl = null;
  let receivedInit = null;

  const result = await fetchLatestRelease(async (url, init) => {
    receivedUrl = url;
    receivedInit = init;

    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => fixturePayload,
    };
  });

  assert.equal(receivedUrl, githubLatestReleaseApiUrl);
  assert.equal(receivedInit.method, "GET");
  assert.equal(receivedInit.headers.Accept, "application/vnd.github+json");
  assert.equal(receivedInit.headers["X-GitHub-Api-Version"], "2022-11-28");
  assert.equal(result.ok, true);
  assert.equal(result.release.version, "0.1.0");
  assert.equal(result.release.assets.length, 2);
});

test("fetchLatestRelease returns a UI-friendly rate limit fallback", async () => {
  const result = await fetchLatestRelease(async () => {
    return {
      ok: false,
      status: 403,
      headers: new Headers([
        ["x-ratelimit-remaining", "0"],
        ["x-ratelimit-reset", "1774078800"],
      ]),
      json: async () => ({
        message: "API rate limit exceeded",
      }),
    };
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "rate_limited");
  assert.equal(result.error.fallbackUrl, githubReleasesPageUrl);
  assert.equal(result.error.status, 403);
  assert.match(result.error.message, /GitHub/i);
});

test("fetchLatestRelease returns a UI-friendly network fallback", async () => {
  const result = await fetchLatestRelease(async () => {
    throw new Error("socket hang up");
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "network_error");
  assert.equal(result.error.fallbackUrl, githubReleasesPageUrl);
  assert.equal(result.error.status, null);
  assert.match(result.error.message, /latest release/i);
});

test("fetchLatestRelease returns a fallback when GitHub payload is malformed", async () => {
  const result = await fetchLatestRelease(async () => {
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ tag_name: "v0.1.0" }),
    };
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "invalid_payload");
  assert.equal(result.error.fallbackUrl, githubReleasesPageUrl);
  assert.equal(result.error.status, 200);
  assert.match(result.error.message, /release data/i);
});

test("writeLatestReleaseCache persists a normalized release that readLatestReleaseCache can restore", () => {
  const storage = createMemoryStorage();
  const release = mapLatestReleasePayload(fixturePayload);

  writeLatestReleaseCache(release, storage);

  assert.equal(typeof storage.getItem(latestReleaseCacheKey), "string");
  assert.deepEqual(readLatestReleaseCache(storage), release);
});

test("readLatestReleaseCache ignores malformed cached payloads", () => {
  const storage = createMemoryStorage({
    [latestReleaseCacheKey]: JSON.stringify({ tagName: "v0.1.0" }),
  });

  assert.equal(readLatestReleaseCache(storage), null);
});

test("resolveFallbackLatestRelease prefers browser cache before bundled snapshot", () => {
  const release = mapLatestReleasePayload(fixturePayload);
  const storage = createMemoryStorage();

  writeLatestReleaseCache(release, storage);

  const result = resolveFallbackLatestRelease(storage);

  assert.equal(result?.source, "cache");
  assert.deepEqual(result?.release, release);
});

test("resolveFallbackLatestRelease falls back to bundled snapshot when cache is empty", () => {
  const storage = createMemoryStorage();
  const result = resolveFallbackLatestRelease(storage);

  assert.equal(result?.source, "snapshot");
  assert.deepEqual(result?.release, bundledLatestRelease);
});

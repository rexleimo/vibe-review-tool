import { latestReleaseSnapshot } from "../content/releaseSnapshot.ts";

export const githubRepoOwner = "rexleimo";
export const githubRepoName = "vibe-review-tool";
export const githubLatestReleaseApiUrl = `https://api.github.com/repos/${githubRepoOwner}/${githubRepoName}/releases/latest`;
export const githubReleasesPageUrl = `https://github.com/${githubRepoOwner}/${githubRepoName}/releases`;
export const latestReleaseCacheKey = "signal-desk.latest-release";

export type LatestReleaseAsset = {
  name: string;
  downloadUrl: string;
  contentType: string | null;
  size: number | null;
};

export type LatestRelease = {
  tagName: string;
  version: string;
  name: string;
  releaseUrl: string;
  publishedAt: string | null;
  assets: LatestReleaseAsset[];
};

export type LatestReleaseErrorCode =
  | "http_error"
  | "invalid_payload"
  | "network_error"
  | "rate_limited";

export type LatestReleaseError = {
  code: LatestReleaseErrorCode;
  message: string;
  fallbackUrl: string;
  status: number | null;
  retryAt: string | null;
};

export type LatestReleaseResult =
  | {
      ok: true;
      release: LatestRelease;
    }
  | {
      ok: false;
      error: LatestReleaseError;
    };

export type LatestReleaseFallbackSource = "cache" | "snapshot";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type FetchHeadersLike = {
  get(name: string): string | null;
};

type FetchResponseLike = {
  ok: boolean;
  status: number;
  headers: FetchHeadersLike;
  json(): Promise<unknown>;
};

type FetchLatestReleaseLike = (
  input: string,
  init?: RequestInit,
) => Promise<FetchResponseLike>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readRequiredString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`GitHub latest release payload is missing ${key}`);
  }

  return value;
}

function normalizeVersion(tagName: string): string {
  const version = tagName.trim().replace(/^v/i, "");
  return version.length > 0 ? version : tagName.trim();
}

function readOptionalString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`Latest release payload has invalid ${key}`);
  }

  return value;
}

function readOptionalNumber(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key];

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Latest release payload has invalid ${key}`);
  }

  return value;
}

function mapReleaseAsset(asset: unknown, index: number): LatestReleaseAsset {
  if (!isRecord(asset)) {
    throw new Error(`GitHub latest release payload has invalid assets[${index}]`);
  }

  const name = readRequiredString(asset, "name");
  const downloadUrl = readRequiredString(asset, "browser_download_url");
  const contentTypeValue = asset.content_type;
  const sizeValue = asset.size;

  if (contentTypeValue !== undefined && contentTypeValue !== null && typeof contentTypeValue !== "string") {
    throw new Error(`GitHub latest release payload has invalid assets[${index}].content_type`);
  }

  if (sizeValue !== undefined && sizeValue !== null && (!Number.isFinite(sizeValue) || typeof sizeValue !== "number")) {
    throw new Error(`GitHub latest release payload has invalid assets[${index}].size`);
  }

  return {
    name,
    downloadUrl,
    contentType: typeof contentTypeValue === "string" ? contentTypeValue : null,
    size: typeof sizeValue === "number" ? sizeValue : null,
  };
}

function mapStoredReleaseAsset(asset: unknown, index: number): LatestReleaseAsset {
  if (!isRecord(asset)) {
    throw new Error(`Stored latest release payload has invalid assets[${index}]`);
  }

  return {
    name: readRequiredString(asset, "name"),
    downloadUrl: readRequiredString(asset, "downloadUrl"),
    contentType: readOptionalString(asset, "contentType"),
    size: readOptionalNumber(asset, "size"),
  };
}

function getRetryAt(headers: FetchHeadersLike): string | null {
  const resetValue = headers.get("x-ratelimit-reset");

  if (resetValue === null) {
    return null;
  }

  const epochSeconds = Number(resetValue);

  if (!Number.isFinite(epochSeconds)) {
    return null;
  }

  return new Date(epochSeconds * 1000).toISOString();
}

function buildFallbackError(input: {
  code: LatestReleaseErrorCode;
  message: string;
  status: number | null;
  retryAt?: string | null;
}): LatestReleaseError {
  return {
    code: input.code,
    message: input.message,
    fallbackUrl: githubReleasesPageUrl,
    status: input.status,
    retryAt: input.retryAt ?? null,
  };
}

function mapFetchFailure(response: FetchResponseLike): LatestReleaseError {
  const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
  const isRateLimited = response.status === 429 || (response.status === 403 && rateLimitRemaining === "0");

  if (isRateLimited) {
    return buildFallbackError({
      code: "rate_limited",
      message: "GitHub rate limit reached. View the latest release on GitHub instead.",
      status: response.status,
      retryAt: getRetryAt(response.headers),
    });
  }

  return buildFallbackError({
    code: "http_error",
    message: "Unable to load the latest release from GitHub right now. View it on GitHub instead.",
    status: response.status,
  });
}

export function mapLatestReleasePayload(payload: unknown): LatestRelease {
  if (!isRecord(payload)) {
    throw new Error("GitHub latest release payload must be an object");
  }

  const assets = payload.assets;

  if (!Array.isArray(assets)) {
    throw new Error("GitHub latest release payload is missing assets");
  }

  const tagName = readRequiredString(payload, "tag_name");
  const name = readRequiredString(payload, "name");
  const releaseUrl = readRequiredString(payload, "html_url");
  const publishedAtValue = payload.published_at;

  if (publishedAtValue !== undefined && publishedAtValue !== null && typeof publishedAtValue !== "string") {
    throw new Error("GitHub latest release payload has invalid published_at");
  }

  return {
    tagName,
    version: normalizeVersion(tagName),
    name,
    releaseUrl,
    publishedAt: typeof publishedAtValue === "string" ? publishedAtValue : null,
    assets: assets.map(mapReleaseAsset),
  };
}

function mapStoredLatestRelease(payload: unknown): LatestRelease {
  if (!isRecord(payload)) {
    throw new Error("Stored latest release payload must be an object");
  }

  const assets = payload.assets;

  if (!Array.isArray(assets)) {
    throw new Error("Stored latest release payload is missing assets");
  }

  const tagName = readRequiredString(payload, "tagName");
  const version = normalizeVersion(tagName);

  return {
    tagName,
    version,
    name: readRequiredString(payload, "name"),
    releaseUrl: readRequiredString(payload, "releaseUrl"),
    publishedAt: readOptionalString(payload, "publishedAt"),
    assets: assets.map(mapStoredReleaseAsset),
  };
}

function getDefaultStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }

    return window.localStorage;
  } catch {
    return null;
  }
}

export const bundledLatestRelease = mapStoredLatestRelease(latestReleaseSnapshot);

export function readLatestReleaseCache(storage: StorageLike | null = getDefaultStorage()): LatestRelease | null {
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(latestReleaseCacheKey);

    if (!raw) {
      return null;
    }

    return mapStoredLatestRelease(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeLatestReleaseCache(
  release: LatestRelease,
  storage: StorageLike | null = getDefaultStorage(),
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(latestReleaseCacheKey, JSON.stringify(release));
  } catch {
    // Ignore storage quota and privacy-mode failures. The live release data is still usable.
  }
}

export function resolveFallbackLatestRelease(
  storage: StorageLike | null = getDefaultStorage(),
): { source: LatestReleaseFallbackSource; release: LatestRelease } | null {
  const cachedRelease = readLatestReleaseCache(storage);

  if (cachedRelease) {
    return {
      source: "cache",
      release: cachedRelease,
    };
  }

  return {
    source: "snapshot",
    release: bundledLatestRelease,
  };
}

export async function fetchLatestRelease(
  fetchImpl: FetchLatestReleaseLike = fetch,
): Promise<LatestReleaseResult> {
  try {
    const response = await fetchImpl(githubLatestReleaseApiUrl, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        error: mapFetchFailure(response),
      };
    }

    const payload = await response.json();

    try {
      return {
        ok: true,
        release: mapLatestReleasePayload(payload),
      };
    } catch {
      return {
        ok: false,
        error: buildFallbackError({
          code: "invalid_payload",
          message: "Latest release data is unavailable right now. View it on GitHub instead.",
          status: response.status,
        }),
      };
    }
  } catch {
    return {
      ok: false,
      error: buildFallbackError({
        code: "network_error",
        message: "Unable to load the latest release right now. View it on GitHub instead.",
        status: null,
      }),
    };
  }
}

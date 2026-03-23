import {
  formatReleaseAssetLabel,
  type ReleaseAssetArchitecture,
  type ReleaseAssetKind,
  type ReleaseAssetPlatform,
} from "./formatting.ts";

export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size?: number | null;
}

export interface ReleaseDownloadAsset {
  name: string;
  downloadUrl: string;
  label: string;
  platform: ReleaseAssetPlatform;
  kind: ReleaseAssetKind;
  architecture: ReleaseAssetArchitecture;
  size: number | null;
}

export interface PlatformReleaseAssets {
  primary: ReleaseDownloadAsset | null;
  alternates: ReleaseDownloadAsset[];
  advanced: ReleaseDownloadAsset[];
}

export interface ClassifiedReleaseAssets {
  macos: PlatformReleaseAssets;
  windows: PlatformReleaseAssets;
  linux: PlatformReleaseAssets;
  extras: UnclassifiedReleaseAsset[];
}

type ReleaseBucket = "primary" | "alternate" | "advanced" | "extra";

interface NormalizedReleaseAsset extends ReleaseDownloadAsset {
  bucket: ReleaseBucket;
  sortIndex: number;
}

export interface UnclassifiedReleaseAsset {
  name: string;
  downloadUrl: string;
  label: string;
  size: number | null;
}

const PRIMARY_ARCHITECTURE_PRIORITY: Record<ReleaseAssetPlatform, ReleaseAssetArchitecture[]> = {
  macos: ["arm64", "x64", "unknown"],
  windows: ["x64", "arm64", "unknown"],
  linux: ["x64", "arm64", "unknown"],
};

const LINUX_ALTERNATE_KIND_PRIORITY: ReleaseAssetKind[] = ["deb", "rpm"];

function detectAssetKind(name: string): ReleaseAssetKind | null {
  const lowerName = name.toLowerCase();

  if (lowerName.endsWith(".app.tar.gz")) {
    return "app-tar-gz";
  }

  if (lowerName.endsWith(".dmg")) {
    return "dmg";
  }

  if (lowerName.endsWith(".exe")) {
    return "exe";
  }

  if (lowerName.endsWith(".msi")) {
    return "msi";
  }

  if (lowerName.endsWith(".appimage")) {
    return "appimage";
  }

  if (lowerName.endsWith(".deb")) {
    return "deb";
  }

  if (lowerName.endsWith(".rpm")) {
    return "rpm";
  }

  return null;
}

function detectArchitecture(name: string): ReleaseAssetArchitecture {
  const lowerName = name.toLowerCase();

  if (lowerName.includes("aarch64") || lowerName.includes("arm64")) {
    return "arm64";
  }

  if (
    lowerName.includes("x64") ||
    lowerName.includes("amd64") ||
    lowerName.includes("x86_64") ||
    lowerName.includes("intel")
  ) {
    return "x64";
  }

  return "unknown";
}

function detectPlatform(kind: ReleaseAssetKind): ReleaseAssetPlatform {
  if (kind === "dmg" || kind === "app-tar-gz") {
    return "macos";
  }

  if (kind === "exe" || kind === "msi") {
    return "windows";
  }

  return "linux";
}

function detectBucket(platform: ReleaseAssetPlatform, kind: ReleaseAssetKind): ReleaseBucket {
  if (platform === "macos") {
    return kind === "dmg" ? "primary" : "advanced";
  }

  if (platform === "windows") {
    return kind === "exe" ? "primary" : "alternate";
  }

  return kind === "appimage" ? "primary" : "alternate";
}

function getArchitecturePriority(platform: ReleaseAssetPlatform, architecture: ReleaseAssetArchitecture): number {
  return PRIMARY_ARCHITECTURE_PRIORITY[platform].indexOf(architecture);
}

function sortPrimaryCandidates(a: NormalizedReleaseAsset, b: NormalizedReleaseAsset): number {
  return (
    getArchitecturePriority(a.platform, a.architecture) - getArchitecturePriority(b.platform, b.architecture) ||
    a.sortIndex - b.sortIndex
  );
}

function sortAlternateCandidates(a: NormalizedReleaseAsset, b: NormalizedReleaseAsset): number {
  if (a.platform === "linux" && b.platform === "linux") {
    return (
      LINUX_ALTERNATE_KIND_PRIORITY.indexOf(a.kind) - LINUX_ALTERNATE_KIND_PRIORITY.indexOf(b.kind) ||
      getArchitecturePriority(a.platform, a.architecture) - getArchitecturePriority(b.platform, b.architecture) ||
      a.sortIndex - b.sortIndex
    );
  }

  return (
    getArchitecturePriority(a.platform, a.architecture) - getArchitecturePriority(b.platform, b.architecture) ||
    a.sortIndex - b.sortIndex
  );
}

function normalizeAsset(asset: GitHubReleaseAsset, sortIndex: number): NormalizedReleaseAsset | null {
  const kind = detectAssetKind(asset.name);

  if (kind === null) {
    return null;
  }

  const platform = detectPlatform(kind);
  const architecture = detectArchitecture(asset.name);

  return {
    name: asset.name,
    downloadUrl: asset.browser_download_url,
    label: formatReleaseAssetLabel({ platform, kind, architecture }),
    platform,
    kind,
    architecture,
    size: typeof asset.size === "number" ? asset.size : null,
    bucket: detectBucket(platform, kind),
    sortIndex,
  };
}

function toPublicAsset(asset: NormalizedReleaseAsset): ReleaseDownloadAsset {
  return {
    name: asset.name,
    downloadUrl: asset.downloadUrl,
    label: asset.label,
    platform: asset.platform,
    kind: asset.kind,
    architecture: asset.architecture,
    size: asset.size,
  };
}

function finalizePlatformAssets(assets: NormalizedReleaseAsset[]): PlatformReleaseAssets {
  const primaryCandidates = assets
    .filter((asset) => asset.bucket === "primary")
    .sort(sortPrimaryCandidates);
  const alternateCandidates = assets
    .filter((asset) => asset.bucket === "alternate")
    .sort(sortAlternateCandidates);
  const advancedCandidates = assets
    .filter((asset) => asset.bucket === "advanced")
    .sort(sortPrimaryCandidates);

  const primaryAsset = primaryCandidates[0] ? toPublicAsset(primaryCandidates[0]) : null;
  const alternates = [...primaryCandidates.slice(1), ...alternateCandidates].map(toPublicAsset);
  const advanced = advancedCandidates.map(toPublicAsset);

  return {
    primary: primaryAsset,
    alternates,
    advanced,
  };
}

export function classifyReleaseAssets(assets: GitHubReleaseAsset[]): ClassifiedReleaseAssets {
  const groupedAssets: Record<ReleaseAssetPlatform, NormalizedReleaseAsset[]> = {
    macos: [],
    windows: [],
    linux: [],
  };
  const extras: ClassifiedReleaseAssets["extras"] = [];

  assets.forEach((asset, sortIndex) => {
    const normalizedAsset = normalizeAsset(asset, sortIndex);

    if (normalizedAsset === null) {
      extras.push({
        name: asset.name,
        downloadUrl: asset.browser_download_url,
        label: "Download",
        size: typeof asset.size === "number" ? asset.size : null,
      });
      return;
    }

    groupedAssets[normalizedAsset.platform].push(normalizedAsset);
  });

  return {
    macos: finalizePlatformAssets(groupedAssets.macos),
    windows: finalizePlatformAssets(groupedAssets.windows),
    linux: finalizePlatformAssets(groupedAssets.linux),
    extras,
  };
}

export type ReleaseAssetPlatform = "macos" | "windows" | "linux";
export type ReleaseAssetKind = "dmg" | "exe" | "msi" | "appimage" | "deb" | "rpm" | "app-tar-gz";
export type ReleaseAssetArchitecture = "arm64" | "x64" | "unknown";

interface ReleaseAssetLabelInput {
  platform: ReleaseAssetPlatform;
  kind: ReleaseAssetKind;
  architecture: ReleaseAssetArchitecture;
}

export function formatArchitectureLabel(
  platform: ReleaseAssetPlatform,
  architecture: ReleaseAssetArchitecture,
): string | null {
  if (architecture === "unknown") {
    return null;
  }

  if (platform === "macos") {
    return architecture === "arm64" ? "Apple Silicon" : "Intel";
  }

  return architecture === "arm64" ? "ARM64" : "x64";
}

export function formatReleaseAssetLabel({ platform, kind, architecture }: ReleaseAssetLabelInput): string {
  const architectureLabel = formatArchitectureLabel(platform, architecture);

  if (platform === "macos" && kind === "dmg") {
    return architectureLabel ? `macOS (${architectureLabel})` : "macOS";
  }

  if (platform === "macos" && kind === "app-tar-gz") {
    return architectureLabel ? `macOS App Archive (${architectureLabel})` : "macOS App Archive";
  }

  if (platform === "windows" && kind === "exe") {
    return architectureLabel && architecture !== "x64"
      ? `Windows Installer (${architectureLabel})`
      : "Windows Installer";
  }

  if (platform === "windows" && kind === "msi") {
    return architectureLabel && architecture !== "x64" ? `Windows MSI (${architectureLabel})` : "Windows MSI";
  }

  if (platform === "linux" && kind === "appimage") {
    return architectureLabel && architecture !== "x64" ? `Linux AppImage (${architectureLabel})` : "Linux AppImage";
  }

  if (platform === "linux" && kind === "deb") {
    return architectureLabel && architecture !== "x64" ? `Linux DEB Package (${architectureLabel})` : "Linux DEB Package";
  }

  return architectureLabel && architecture !== "x64" ? `Linux RPM Package (${architectureLabel})` : "Linux RPM Package";
}

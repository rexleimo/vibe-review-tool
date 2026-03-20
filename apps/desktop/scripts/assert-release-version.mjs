import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

export function readTauriVersion(tauriConfigPath) {
  const raw = readFileSync(tauriConfigPath, "utf8");
  const config = JSON.parse(raw);
  const version = config?.version;

  if (typeof version !== "string" || version.trim() === "") {
    throw new Error(`Unable to read version from ${tauriConfigPath}`);
  }

  return version.trim();
}

export function readPackageVersion(packageJsonPath) {
  const raw = readFileSync(packageJsonPath, "utf8");
  const pkg = JSON.parse(raw);
  const version = pkg?.version;

  if (typeof version !== "string" || version.trim() === "") {
    throw new Error(`Unable to read version from ${packageJsonPath}`);
  }

  return version.trim();
}

export function readCargoVersion(cargoTomlPath) {
  const raw = readFileSync(cargoTomlPath, "utf8");
  const match = raw.match(/^\s*version\s*=\s*"([^"]+)"\s*$/m);

  if (!match?.[1]) {
    throw new Error(`Unable to read version from ${cargoTomlPath}`);
  }

  return match[1].trim();
}

export function resolveReleaseNotesPath({ releaseNotesDir, tagName }) {
  return path.join(releaseNotesDir, `desktop-${tagName}.md`);
}

export function validateReleaseVersion({
  tagName,
  tauriConfigPath,
  packageJsonPath = path.join(repoRoot, "apps/desktop/package.json"),
  cargoTomlPath = path.join(repoRoot, "apps/desktop/src-tauri/Cargo.toml"),
  releaseNotesDir,
  expectedVersion,
  skipReleaseNotesCheck = false,
}) {
  if (typeof tagName !== "string" || tagName.trim() === "") {
    throw new Error("Release tag is required");
  }

  const normalizedTagName = tagName.trim();
  if (!normalizedTagName.startsWith("v")) {
    throw new Error(`Release tag "${normalizedTagName}" must start with v`);
  }

  const version = expectedVersion ?? readTauriVersion(tauriConfigPath);
  const packageVersion = readPackageVersion(packageJsonPath);
  const cargoVersion = readCargoVersion(cargoTomlPath);
  const tagVersion = normalizedTagName.slice(1);
  if (tagVersion !== version) {
    throw new Error(
      `Release tag "${normalizedTagName}" does not match app version ${version}`,
    );
  }
  if (packageVersion !== version) {
    throw new Error(
      `package.json version ${packageVersion} does not match tauri version ${version}`,
    );
  }
  if (cargoVersion !== version) {
    throw new Error(
      `Cargo.toml version ${cargoVersion} does not match tauri version ${version}`,
    );
  }

  const releaseNotesPath = resolveReleaseNotesPath({
    releaseNotesDir,
    tagName: normalizedTagName,
  });
  if (!skipReleaseNotesCheck && !existsSync(releaseNotesPath)) {
    throw new Error(
      `Tracked release notes file is missing: ${releaseNotesPath}`,
    );
  }

  return {
    tagName: normalizedTagName,
    version,
    releaseNotesPath,
  };
}

function runCli() {
  const tagName = process.argv[2] || process.env.GITHUB_REF_NAME;
  const tauriConfigPath = path.join(
    repoRoot,
    "apps/desktop/src-tauri/tauri.conf.json",
  );
  const packageJsonPath = path.join(repoRoot, "apps/desktop/package.json");
  const cargoTomlPath = path.join(repoRoot, "apps/desktop/src-tauri/Cargo.toml");
  const releaseNotesDir = path.join(repoRoot, ".github/release-notes");
  const result = validateReleaseVersion({
    tagName,
    tauriConfigPath,
    packageJsonPath,
    cargoTomlPath,
    releaseNotesDir,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    runCli();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}

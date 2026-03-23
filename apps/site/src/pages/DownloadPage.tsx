import { useEffect, useMemo, useState } from "react";
import DownloadStatePanel from "../components/DownloadStatePanel";
import PlatformCard, { hasPlatformDownloads } from "../components/PlatformCard";
import ReleaseMetaPanel from "../components/ReleaseMetaPanel";
import SiteShell from "../components/SiteShell";
import { siteCopy } from "../content/siteCopy";
import {
  bundledLatestRelease,
  fetchLatestRelease,
  readLatestReleaseCache,
  resolveFallbackLatestRelease,
  type LatestRelease,
  type LatestReleaseError,
  type LatestReleaseFallbackSource,
  writeLatestReleaseCache,
} from "../lib/githubRelease";
import type { ClassifiedReleaseAssets, GitHubReleaseAsset, PlatformReleaseAssets } from "../lib/releaseAssets";
import { classifyReleaseAssets } from "../lib/releaseAssets";
import type { Locale } from "../lib/locale";

type DownloadPageState =
  | { status: "loading" }
  | { status: "ready"; release: LatestRelease; assets: ClassifiedReleaseAssets; source: "live" | LatestReleaseFallbackSource }
  | { status: "empty"; release: LatestRelease; source: "live" | LatestReleaseFallbackSource }
  | { status: "error"; error: LatestReleaseError };

function toGitHubReleaseAssets(assets: LatestRelease["assets"]): GitHubReleaseAsset[] {
  return assets.map((asset) => ({
    name: asset.name,
    browser_download_url: asset.downloadUrl,
    size: asset.size,
  }));
}

function hasAnyReleaseDownloads(assets: ClassifiedReleaseAssets): boolean {
  return (
    hasPlatformDownloads(assets.macos) ||
    hasPlatformDownloads(assets.windows) ||
    hasPlatformDownloads(assets.linux)
  );
}

function resolvePlatformAssets(
  platformId: "macos" | "windows" | "linux",
  assets: ClassifiedReleaseAssets,
): PlatformReleaseAssets {
  return assets[platformId];
}

function buildDownloadPageState(
  release: LatestRelease,
  source: "live" | LatestReleaseFallbackSource,
): Extract<DownloadPageState, { status: "ready" | "empty" }> {
  const classifiedAssets = classifyReleaseAssets(toGitHubReleaseAssets(release.assets));

  if (!hasAnyReleaseDownloads(classifiedAssets)) {
    return {
      status: "empty",
      release,
      source,
    };
  }

  return {
    status: "ready",
    release,
    assets: classifiedAssets,
    source,
  };
}

function DownloadPage({ locale }: { locale: Locale }) {
  const copy = siteCopy[locale].download;
  const [state, setState] = useState<DownloadPageState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    async function loadRelease() {
      const cachedRelease = readLatestReleaseCache();
      const optimisticFallback = cachedRelease ?? bundledLatestRelease;

      if (active) {
        setState(buildDownloadPageState(optimisticFallback, cachedRelease ? "cache" : "snapshot"));
      }

      const result = await fetchLatestRelease();

      if (!active) {
        return;
      }

      if (result.ok) {
        writeLatestReleaseCache(result.release);
        setState(buildDownloadPageState(result.release, "live"));
        return;
      }

      const fallback = resolveFallbackLatestRelease();

      if (fallback) {
        setState(buildDownloadPageState(fallback.release, fallback.source));
        return;
      }

      setState({ status: "error", error: result.error });
    }

    void loadRelease();

    return () => {
      active = false;
    };
  }, []);

  const platformCards = useMemo(() => {
    if (state.status !== "ready") {
      return [];
    }

    return copy.platforms
      .map((platform) => ({
        ...platform,
        assets: resolvePlatformAssets(platform.id, state.assets),
      }))
      .filter((platform) => hasPlatformDownloads(platform.assets));
  }, [copy.platforms, state]);

  return (
    <SiteShell locale={locale}>
      <main className="download-page">
        <section className="hero-card">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="lede">{copy.intro}</p>
        </section>
        <section className="download-grid">
          <div className="download-main">
            {state.status === "loading" && (
              <DownloadStatePanel
                label={copy.states.loadingLabel}
                tone="loading"
                title={copy.states.loadingTitle}
                body={copy.states.loadingBody}
              />
            )}

            {state.status === "error" && (
              <DownloadStatePanel
                label={copy.states.errorLabel}
                tone="error"
                title={copy.states.errorTitle}
                body={copy.states.errorBody}
                ctaLabel={copy.states.errorCta}
                ctaHref={state.error.fallbackUrl}
              />
            )}

            {state.status === "empty" && (
              <DownloadStatePanel
                label={copy.states.emptyLabel}
                tone="empty"
                title={copy.states.emptyTitle}
                body={copy.states.emptyBody}
                ctaLabel={copy.states.errorCta}
                ctaHref={state.release.releaseUrl}
              />
            )}

            {state.status === "ready" && (
              <div className="platform-grid">
                {platformCards.map((platform) => (
                  <PlatformCard
                    key={platform.id}
                    title={platform.title}
                    description={platform.description}
                    assets={platform.assets}
                    copy={copy.groups}
                  />
                ))}
              </div>
            )}
          </div>

          {(state.status === "ready" || state.status === "empty") && (
            <ReleaseMetaPanel
              locale={locale}
              source={state.source}
              release={state.release}
              copy={copy.releaseMeta}
            />
          )}
        </section>
      </main>
    </SiteShell>
  );
}

export default DownloadPage;

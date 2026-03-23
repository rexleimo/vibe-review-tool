import type { PlatformReleaseAssets, ReleaseDownloadAsset } from "../lib/releaseAssets";

interface PlatformCardProps {
  title: string;
  description: string;
  assets: PlatformReleaseAssets;
  copy: {
    primaryLabel: string;
    alternatesLabel: string;
    advancedLabel: string;
  };
}

function renderAssetLink(asset: ReleaseDownloadAsset) {
  return (
    <li key={`${asset.name}-${asset.downloadUrl}`}>
      <a href={asset.downloadUrl} target="_blank" rel="noreferrer">
        {asset.label}
      </a>
    </li>
  );
}

export function hasPlatformDownloads(assets: PlatformReleaseAssets): boolean {
  return assets.primary !== null || assets.alternates.length > 0 || assets.advanced.length > 0;
}

function PlatformCard({ title, description, assets, copy }: PlatformCardProps) {
  if (!hasPlatformDownloads(assets)) {
    return null;
  }

  return (
    <article className="platform-card">
      <p className="section-label">{title}</p>
      <p className="platform-card-description">{description}</p>

      {assets.primary && (
        <div className="download-group">
          <p className="download-group-label">{copy.primaryLabel}</p>
          <a
            className="primary-button platform-card-primary"
            href={assets.primary.downloadUrl}
            target="_blank"
            rel="noreferrer"
          >
            {assets.primary.label}
          </a>
        </div>
      )}

      {assets.alternates.length > 0 && (
        <div className="download-group">
          <p className="download-group-label">{copy.alternatesLabel}</p>
          <ul className="download-link-list">{assets.alternates.map(renderAssetLink)}</ul>
        </div>
      )}

      {assets.advanced.length > 0 && (
        <div className="download-group">
          <p className="download-group-label">{copy.advancedLabel}</p>
          <ul className="download-link-list">{assets.advanced.map(renderAssetLink)}</ul>
        </div>
      )}
    </article>
  );
}

export default PlatformCard;

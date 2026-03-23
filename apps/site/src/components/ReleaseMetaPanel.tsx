interface ReleaseMetaPanelProps {
  locale: "en" | "zh";
  source: "live" | "cache" | "snapshot";
  release: {
    version: string;
    name: string;
    releaseUrl: string;
    publishedAt: string | null;
  };
  copy: {
    title: string;
    versionLabel: string;
    publishedLabel: string;
    sourceLabel: string;
    sourceValue: string;
    notesLabel: string;
    notesCta: string;
    checksumLabel: string;
    checksumPending: string;
    liveNote: string;
    cacheNote: string;
    snapshotNote: string;
  };
}

function formatPublishedDate(value: string | null, locale: "en" | "zh"): string {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function resolveSourceNote(
  source: ReleaseMetaPanelProps["source"],
  copy: ReleaseMetaPanelProps["copy"],
): string {
  if (source === "cache") {
    return copy.cacheNote;
  }

  if (source === "snapshot") {
    return copy.snapshotNote;
  }

  return copy.liveNote;
}

function ReleaseMetaPanel({ locale, source, release, copy }: ReleaseMetaPanelProps) {
  return (
    <aside className="release-meta-panel">
      <p className="section-label">{copy.title}</p>
      <h2>{release.name}</h2>
      <p className="release-source-note">{resolveSourceNote(source, copy)}</p>
      <dl className="release-meta-list">
        <div>
          <dt>{copy.versionLabel}</dt>
          <dd>{release.version}</dd>
        </div>
        <div>
          <dt>{copy.publishedLabel}</dt>
          <dd>{formatPublishedDate(release.publishedAt, locale)}</dd>
        </div>
        <div>
          <dt>{copy.sourceLabel}</dt>
          <dd>
            <a href={release.releaseUrl} target="_blank" rel="noreferrer">
              {copy.sourceValue}
            </a>
          </dd>
        </div>
        <div>
          <dt>{copy.notesLabel}</dt>
          <dd>
            <a href={release.releaseUrl} target="_blank" rel="noreferrer">
              {copy.notesCta}
            </a>
          </dd>
        </div>
      </dl>
      <div className="release-verification-note">
        <p className="download-group-label">{copy.checksumLabel}</p>
        <p>{copy.checksumPending}</p>
      </div>
    </aside>
  );
}

export default ReleaseMetaPanel;

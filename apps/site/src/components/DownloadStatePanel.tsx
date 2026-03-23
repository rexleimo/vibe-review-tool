interface DownloadStatePanelProps {
  label: string;
  title: string;
  body: string;
  detail?: string;
  tone: "loading" | "error" | "empty";
  ctaLabel?: string;
  ctaHref?: string;
}

function DownloadStatePanel({ label, title, body, detail, tone, ctaLabel, ctaHref }: DownloadStatePanelProps) {
  return (
    <section className={`download-state-panel ${tone}`}>
      <p className="section-label">{label}</p>
      <h2>{title}</h2>
      <p className="lede">{body}</p>
      {detail && <p className="download-state-detail">{detail}</p>}
      {ctaLabel && ctaHref && (
        <a className="secondary-button" href={ctaHref} target="_blank" rel="noreferrer">
          {ctaLabel}
        </a>
      )}
    </section>
  );
}

export default DownloadStatePanel;

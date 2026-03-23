import DownloadCtaSection from "../components/DownloadCtaSection";
import SiteShell from "../components/SiteShell";
import WorkflowStrip from "../components/WorkflowStrip";
import WhyItWorksSection from "../components/WhyItWorksSection";
import AiClientsSection from "../components/AiClientsSection";
import { siteCopy } from "../content/siteCopy";
import type { Locale } from "../lib/locale";
import { buildLocalePath } from "../lib/routes";
import { Link } from "react-router-dom";

function HomePage({ locale }: { locale: Locale }) {
  const copy = siteCopy[locale].home;
  const downloadPath = buildLocalePath({ locale, page: "download" });
  const workflowHref = `${buildLocalePath({ locale, page: "home" })}#workflow`;

  return (
    <SiteShell locale={locale}>
      <main className="home-page">
        <section className="hero-grid">
          <article className="hero-card">
            <p className="eyebrow">{copy.hero.eyebrow}</p>
            <h1>{copy.hero.title}</h1>
            <p className="lede">{copy.hero.body}</p>
            <div className="hero-actions">
              <Link className="primary-button" to={downloadPath}>
                {copy.hero.primary}
              </Link>
              <a className="secondary-button" href={workflowHref}>
                {copy.hero.secondary}
              </a>
            </div>
          </article>
          <aside className="artifact-card" aria-label={copy.labels.desktopPreview}>
            <p className="section-label">{copy.labels.desktopPreview}</p>
            <h2>{copy.preview.title}</h2>
            <p className="lede">{copy.preview.body}</p>
          </aside>
        </section>
        <WorkflowStrip locale={locale} />
        <WhyItWorksSection locale={locale} />
        <AiClientsSection locale={locale} />
        <DownloadCtaSection locale={locale} />
      </main>
    </SiteShell>
  );
}

export default HomePage;

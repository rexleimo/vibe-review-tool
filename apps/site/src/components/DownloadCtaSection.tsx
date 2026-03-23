import { Link } from "react-router-dom";
import { siteCopy } from "../content/siteCopy";
import type { Locale } from "../lib/locale";
import { buildLocalePath } from "../lib/routes";

function DownloadCtaSection({ locale }: { locale: Locale }) {
  const home = siteCopy[locale].home;
  const section = home.cta;

  return (
    <section className="cta-band">
      <div>
        <p className="section-label">{home.labels.download}</p>
        <h2>{section.title}</h2>
        <p className="lede">{section.body}</p>
      </div>
      <Link className="primary-button" to={buildLocalePath({ locale, page: "download" })}>
        {section.primary}
      </Link>
    </section>
  );
}

export default DownloadCtaSection;

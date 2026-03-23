import { siteCopy } from "../content/siteCopy";
import type { Locale } from "../lib/locale";

function WhyItWorksSection({ locale }: { locale: Locale }) {
  const home = siteCopy[locale].home;
  const section = home.whyItWorks;

  return (
    <section className="editorial-section" id="why-it-works">
      <p className="section-label">{home.labels.whyItWorks}</p>
      <h2>{section.title}</h2>
      <div className="editorial-points">
        {section.points.map((point) => (
          <article key={point} className="editorial-point">
            <p>{point}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default WhyItWorksSection;

import { siteCopy } from "../content/siteCopy";
import type { Locale } from "../lib/locale";

function DownloadPage({ locale }: { locale: Locale }) {
  const copy = siteCopy[locale].download;

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Download</p>
        <h1>{copy.title}</h1>
        <p className="lede">{copy.intro}</p>
      </section>
    </main>
  );
}

export default DownloadPage;

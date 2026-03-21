import { siteCopy } from "../content/siteCopy";
import type { Locale } from "../lib/locale";

function HomePage({ locale }: { locale: Locale }) {
  const copy = siteCopy[locale].home;

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">{copy.hero.eyebrow}</p>
        <h1>{copy.hero.title}</h1>
        <p className="lede">{copy.hero.body}</p>
      </section>
    </main>
  );
}

export default HomePage;

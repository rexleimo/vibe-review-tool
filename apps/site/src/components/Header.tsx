import { Link } from "react-router-dom";
import type { Locale } from "../lib/locale";
import { buildLocalePath, primaryNavIds } from "../lib/routes";
import LanguageToggle from "./LanguageToggle";

const labels = {
  en: {
    workflow: "Workflow",
    whyItWorks: "Why It Works",
    download: "Download",
  },
  zh: {
    workflow: "工作流",
    whyItWorks: "为什么这样更好",
    download: "下载",
  },
} as const;

function Header({ locale }: { locale: Locale }) {
  const copy = labels[locale];
  const homePath = buildLocalePath({ locale, page: "home" });
  const downloadPath = buildLocalePath({ locale, page: "download" });

  return (
    <header className="site-header">
      <Link className="wordmark" to={homePath}>
        Signal Desk
      </Link>
      <nav className="site-nav" aria-label="Primary">
        <a href={`${homePath}#${primaryNavIds[0]}`}>{copy.workflow}</a>
        <a href={`${homePath}#${primaryNavIds[1]}`}>{copy.whyItWorks}</a>
        <Link to={downloadPath}>{copy.download}</Link>
      </nav>
      <LanguageToggle locale={locale} />
    </header>
  );
}

export default Header;

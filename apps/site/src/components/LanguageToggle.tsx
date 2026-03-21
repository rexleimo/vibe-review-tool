import { Link, useLocation } from "react-router-dom";
import type { Locale } from "../lib/locale";
import { buildLanguageSwitchTarget } from "../lib/routes";

function LanguageToggle({ locale }: { locale: Locale }) {
  const location = useLocation();
  const target = buildLanguageSwitchTarget(location.pathname);

  return (
    <Link className="language-toggle" to={target}>
      {locale === "en" ? "中文" : "EN"}
    </Link>
  );
}

export default LanguageToggle;

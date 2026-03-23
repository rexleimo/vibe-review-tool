import { siteCopy } from "../content/siteCopy";
import type { Locale } from "../lib/locale";

function Footer({ locale }: { locale: Locale }) {
  return (
    <footer className="site-footer">
      <p>{siteCopy[locale].footer.body}</p>
    </footer>
  );
}

export default Footer;

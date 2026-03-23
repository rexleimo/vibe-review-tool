import type { PropsWithChildren } from "react";
import type { Locale } from "../lib/locale";
import Footer from "./Footer";
import Header from "./Header";

function SiteShell({ children, locale }: PropsWithChildren<{ locale: Locale }>) {
  return (
    <div className="site-shell">
      <Header locale={locale} />
      {children}
      <Footer locale={locale} />
    </div>
  );
}

export default SiteShell;

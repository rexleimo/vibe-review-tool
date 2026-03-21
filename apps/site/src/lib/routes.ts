import { resolveLocaleFromPath, type Locale } from "./locale.ts";

export type SitePage = "home" | "download";

export const publicRoutePaths = ["/", "/download", "/zh", "/zh/download"] as const;
export const primaryNavIds = ["workflow", "why-it-works", "download"] as const;

export function buildLocalePath({ locale, page }: { locale: Locale; page: SitePage }): string {
  if (locale === "zh") {
    return page === "home" ? "/zh" : "/zh/download";
  }

  return page === "home" ? "/" : "/download";
}

function resolvePageFromPath(pathname: string): SitePage {
  return pathname.endsWith("/download") || pathname === "/download" ? "download" : "home";
}

export function buildLanguageSwitchTarget(pathname: string): string {
  const locale = resolveLocaleFromPath(pathname);
  const nextLocale: Locale = locale === "en" ? "zh" : "en";
  return buildLocalePath({ locale: nextLocale, page: resolvePageFromPath(pathname) });
}

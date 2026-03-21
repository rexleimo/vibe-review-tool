import type { Locale } from "./locale";

export type SitePage = "home" | "download";

export const publicRoutePaths = ["/", "/download", "/zh", "/zh/download"] as const;

export function buildLocalePath({ locale, page }: { locale: Locale; page: SitePage }): string {
  if (locale === "zh") {
    return page === "home" ? "/zh" : "/zh/download";
  }

  return page === "home" ? "/" : "/download";
}

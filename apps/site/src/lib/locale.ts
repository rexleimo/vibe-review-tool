export type Locale = "en" | "zh";

export function resolveLocaleFromPath(pathname: string): Locale {
  return pathname === "/zh" || pathname.startsWith("/zh/") ? "zh" : "en";
}

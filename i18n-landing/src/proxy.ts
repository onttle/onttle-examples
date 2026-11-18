import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, type Locale } from "@/i18n/locales";

const COOKIE = "NEXT_LOCALE";

function preferred(request: NextRequest): Locale {
  const saved = request.cookies.get(COOKIE)?.value;
  if (isLocale(saved)) return saved;
  // English only when it is the first language; everything else gets Korean.
  return request.headers.get("accept-language")?.trim().toLowerCase().startsWith("en") ? "en" : defaultLocale;
}

/**
 * "/"            → redirect to /ko or /en (cookie first, then Accept-Language).
 * "/ko", "/en"   → remember the language the visitor opened, so the next visit to "/" goes there.
 * Paths here do not include the basePath; nextUrl keeps it when redirecting.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = `/${preferred(request)}`;
    const response = NextResponse.redirect(url, 307);
    response.headers.set("Vary", "Accept-Language, Cookie");
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const locale = pathname.slice(1);
  const response = NextResponse.next();
  if (isLocale(locale) && request.cookies.get(COOKIE)?.value !== locale) {
    response.cookies.set(COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return response;
}

export const config = {
  matcher: ["/", "/ko", "/en"],
};

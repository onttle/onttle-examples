import { NextResponse, type NextRequest } from "next/server";
import { refreshSession, type MemberSession } from "@/lib/onttle";
import { ACCESS_COOKIE, REFRESH_COOKIE, clearSession, writeSession } from "@/lib/session";

/**
 * Keeps a member signed in across the 15-minute access token.
 * When the access cookie has expired but the refresh cookie is still there, the proxy refreshes the
 * session before the page renders (Server Components cannot write cookies) and passes the new access
 * token on to this request too.
 *
 * Refresh tokens are single use, and sending a used one signs that login out everywhere. So:
 * - prefetch requests never refresh (a page full of links would send the same token many times);
 * - concurrent requests with the same refresh token share one refresh call.
 *
 * Pages that need a member (/new, /f/{id}/edit) redirect to /login when there is no session at all.
 * Paths here do not include the basePath; nextUrl keeps it when redirecting.
 */

const inFlight = new Map<string, Promise<MemberSession | null>>();

function refreshOnce(token: string) {
  let pending = inFlight.get(token);
  if (!pending) {
    pending = refreshSession(token).catch(() => null);
    inFlight.set(token, pending);
    // Keep the answer briefly for requests that arrive right after (they still carry the old cookie).
    pending.finally(() => setTimeout(() => inFlight.delete(token), 10_000));
  }
  return pending;
}

function needsMember(pathname: string) {
  return pathname === "/new" || /^\/f\/[^/]+\/edit$/.test(pathname);
}

function isPrefetch(request: NextRequest) {
  return (
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("sec-purpose")?.includes("prefetch") === true
  );
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!access && refresh && !isPrefetch(request)) {
    const session = await refreshOnce(refresh);
    if (session) {
      // The page rendering now reads the new token from the request; the browser stores it from the response.
      request.cookies.set(ACCESS_COOKIE, session.accessToken);
      request.cookies.set(REFRESH_COOKIE, session.refreshToken);
      const response = NextResponse.next({ request: { headers: request.headers } });
      writeSession(response.cookies, session);
      return response;
    }
    // Expired or revoked refresh token: sign out locally.
    request.cookies.delete(ACCESS_COOKIE);
    request.cookies.delete(REFRESH_COOKIE);
    const response = needsMember(pathname)
      ? NextResponse.redirect(loginUrl(request, pathname + search))
      : NextResponse.next({ request: { headers: request.headers } });
    clearSession(response.cookies);
    return response;
  }

  if (!access && !refresh && needsMember(pathname)) {
    return NextResponse.redirect(loginUrl(request, pathname + search));
  }

  return NextResponse.next();
}

function loginUrl(request: NextRequest, next: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(next)}`;
  return url;
}

export const config = {
  // Pages only: no static files, images or Next.js internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|css|js)$).*)"],
};

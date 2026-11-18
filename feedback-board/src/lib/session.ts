import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BASE_PATH } from "./base-path";
import { OnttleError, refreshSession, type MemberSession } from "./onttle";

/**
 * Member session in the app's own cookies (BFF). The browser holds three httpOnly cookies scoped to
 * /feedback-board and never sees a token in JavaScript:
 *   fb_at    access token, expires with the token (expiresIn, 15 minutes on this project)
 *   fb_rt    refresh token, 30 days (the project's refresh lifetime). Single use: rotated on every refresh
 *   fb_name  display name for the header, so the header does not call GET /me on every page
 * Cookies are written only in Server Actions (src/app/actions.ts) and in the proxy (src/proxy.ts):
 * Next.js does not allow setting cookies while a Server Component renders.
 */

export const ACCESS_COOKIE = "fb_at";
export const REFRESH_COOKIE = "fb_rt";
export const NAME_COOKIE = "fb_name";

const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

interface CookieWriter {
  set(name: string, value: string, options: Record<string, unknown>): unknown;
}

function options(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: BASE_PATH,
    maxAge,
  };
}

/** Writes both tokens (and the name) to a cookie store: cookies() in an action, response.cookies in the proxy. */
export function writeSession(store: CookieWriter, session: MemberSession, name?: string) {
  // Expire the cookie a little before the token, so a request never carries an access token that just died.
  store.set(ACCESS_COOKIE, session.accessToken, options(Math.max(session.expiresIn - 30, 30)));
  store.set(REFRESH_COOKIE, session.refreshToken, options(REFRESH_MAX_AGE));
  const displayName = name ?? displayNameOf(session);
  store.set(NAME_COOKIE, encodeURIComponent(displayName), options(REFRESH_MAX_AGE));
}

export function clearSession(store: CookieWriter) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, NAME_COOKIE]) store.set(name, "", options(0));
}

export function displayNameOf(session: MemberSession) {
  const name = session.member.profile?.name;
  return typeof name === "string" && name.trim() ? name.trim().slice(0, 40) : "Member";
}

/** For Server Components: who is signed in, from the cookies only (no API call). */
export async function readSession() {
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;
  const refresh = store.get(REFRESH_COOKIE)?.value;
  const rawName = store.get(NAME_COOKIE)?.value;
  return {
    signedIn: Boolean(access || refresh),
    access,
    refresh,
    name: rawName ? decodeURIComponent(rawName) : "Member",
  };
}

/**
 * For Server Actions: runs `fn` with a valid access token.
 * No access cookie, or a 401 from Onttle → refresh once (rotating the refresh token) and retry once.
 * No session or a failed refresh → clear the cookies and go to /login?next=…
 */
export async function withMember<T>(next: string, fn: (token: string) => Promise<T>): Promise<T> {
  const store = await cookies();
  let access = store.get(ACCESS_COOKIE)?.value;

  const renew = async () => {
    const refresh = store.get(REFRESH_COOKIE)?.value;
    if (!refresh) return null;
    try {
      const session = await refreshSession(refresh);
      writeSession(store, session);
      return session.accessToken;
    } catch {
      return null;
    }
  };

  if (!access) access = (await renew()) ?? undefined;
  if (!access) {
    clearSession(store);
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  try {
    return await fn(access);
  } catch (e) {
    if (!(e instanceof OnttleError) || e.status !== 401) throw e;
    const renewed = await renew();
    if (!renewed) {
      clearSession(store);
      redirect(`/login?next=${encodeURIComponent(next)}`);
    }
    return fn(renewed);
  }
}

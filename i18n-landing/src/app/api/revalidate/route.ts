import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";
import { CACHE_TAG } from "@/lib/onttle";

/**
 * Clears the landing cache (translations, variables, features, plans) at once.
 *   POST /i18n-landing/api/revalidate
 *   Authorization: Bearer <REVALIDATE_SECRET>
 * Onttle webhooks fire on table content events only, so call this by hand after changing
 * a translation or a variable (or wait up to 5 minutes for the cache to expire).
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return Response.json({ ok: false }, { status: 401 });
  }
  revalidateTag(CACHE_TAG, "max");
  return Response.json({ ok: true, revalidated: [CACHE_TAG] });
}

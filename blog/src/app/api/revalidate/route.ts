import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";

/**
 * Clears the cache from an Onttle webhook (content CREATED/UPDATED/DELETED) or a manual call.
 *   POST /api/revalidate
 *   Authorization: Bearer <REVALIDATE_SECRET>
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return Response.json({ ok: false }, { status: 401 });
  }
  revalidateTag("posts", "max");
  return Response.json({ ok: true, revalidated: ["posts"] });
}

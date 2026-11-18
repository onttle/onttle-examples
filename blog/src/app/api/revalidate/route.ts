import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";

/**
 * Onttle 웹훅(콘텐츠 CREATED/UPDATED/DELETED)이나 수동 호출로 캐시를 비운다.
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

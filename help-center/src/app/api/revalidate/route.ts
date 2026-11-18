import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";

/**
 * Onttle 웹훅(콘텐츠 CREATED/UPDATED/DELETED)이나 수동 호출로 FAQ 캐시를 비운다.
 *   POST /help-center/api/revalidate
 *   Authorization: Bearer <REVALIDATE_SECRET>
 * 검색·AI 답변은 Vector 동기화 기준이라, FAQ를 고치면 대시보드에서 재동기화도 해야 한다.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return Response.json({ ok: false }, { status: 401 });
  }
  revalidateTag("faqs", "max");
  return Response.json({ ok: true, revalidated: ["faqs"] });
}

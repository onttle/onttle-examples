import type { AskError, AskResponse, AskSource } from "@/lib/ask-types";
import {
  getMessages,
  listFaqs,
  OnttleError,
  sendMessage,
  startChat,
  type ChatMessage,
  type ContentRef,
} from "@/lib/onttle";

/**
 * 브라우저 → POST /help-center/api/ask { message, chatId? }
 * 키는 여기(서버)에만 있고, 공개 데모라 질문 길이와 대화 횟수를 서버에서 막는다.
 *
 * 1. chatId가 있으면 이력을 읽어 AI 답변 수로 횟수 제한을 확인하고, 마지막 메시지 id를 기억한다.
 * 2. POST /chats 또는 /chats/{chatId}/messages → text/plain 스트림을 끝까지 읽어 JSON 하나로.
 * 3. 출처: 스트림의 contents는 { id, table_id }뿐이고 이력도 마찬가지라(실제 응답 기준),
 *    질문·slug는 캐시된 FAQ 목록에서 찾는다. 점수는 이력(GET ?lastId=)의 connections에서.
 */

// GET 이력은 최대 20개 → 사용자+AI 한 쌍씩이라 9턴까지만 이력 한 번으로 셀 수 있다.
const MAX_TURNS = Math.min(Number(process.env.ASK_MAX_TURNS) || 6, 9);
const MAX_LENGTH = Number(process.env.ASK_MAX_MESSAGE_LENGTH) || 300;
const CHAT_ID = /^[\w-]{1,100}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(error: AskError, status: number) {
  return Response.json({ error } satisfies AskResponse, { status });
}

/**
 * 출처 = 스트림의 contents (답변이 실제로 참조한 것, 실측 1~2건).
 * 이력의 connections는 검색 후보 전체(count만큼)라 관계없는 FAQ까지 섞여 있어 점수만 가져온다.
 * score는 실제 응답에서 문자열("0.5256…")로 왔다 → 숫자로 바꾼다.
 */
async function sourcesOf(refs: ContentRef[], latest: ChatMessage | undefined): Promise<AskSource[]> {
  const scores = new Map<string, number>();
  for (const c of latest?.chat_messages_contents_connections ?? []) {
    const score = Number(c.score);
    if (Number.isFinite(score)) scores.set(c.contents.id, score);
  }
  const ids = refs.map((r) => r.id);

  const faqs = await listFaqs();
  const byKey = new Map(faqs.flatMap((f) => [[f.id, f] as const, ...(f.slug ? [[f.slug, f] as const] : [])]));
  const seen = new Set<string>();
  const sources: AskSource[] = [];
  for (const id of ids) {
    const faq = byKey.get(id);
    if (!faq || seen.has(faq.id)) continue; // 발행 목록에 없는 콘텐츠는 링크하지 않는다
    seen.add(faq.id);
    sources.push({ slug: faq.slug ?? faq.id, question: faq.data.question, score: scores.get(id) ?? null });
  }
  return sources;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("bad_request", 400);
  }
  const { message: raw, chatId } = (body ?? {}) as { message?: unknown; chatId?: unknown };
  const message = typeof raw === "string" ? raw.trim() : "";
  if (!message) return fail("empty", 400);
  if (message.length > MAX_LENGTH) return fail("too_long", 400);
  if (chatId != null && (typeof chatId !== "string" || !CHAT_ID.test(chatId))) return fail("bad_request", 400);

  try {
    let id: string;
    let lastId: string | undefined;
    let usedTurns = 0;
    let reply;

    if (chatId) {
      const history = await getMessages(chatId);
      usedTurns = history.filter((m) => m.agent_id).length;
      if (usedTurns >= MAX_TURNS) return fail("turn_limit", 429);
      lastId = history.at(-1)?.id;
      reply = await sendMessage(chatId, message);
      id = chatId;
    } else {
      reply = await startChat(message);
      if (!reply.chatId) throw new Error("Onttle chat stream had no chatId");
      id = reply.chatId;
    }

    // 실제로 한 번, 스트림의 chatId가 34자로 잘려 와서 다음 호출이 모두 500이 난 적이 있다 (BUILD_LOG).
    // 그런 id는 버리고 답변만 돌려준다 → 다음 질문은 새 대화로 시작한다.
    const validId = UUID.test(id);
    if (!validId) console.error(`Onttle chat stream returned a malformed chatId (length ${id.length})`);

    // 출처: 점수는 이력에서, 없으면 스트림의 contents만으로. 실패해도 답변은 돌려준다.
    let sources: AskSource[] = [];
    if (reply.contents?.length) {
      let latest: ChatMessage | undefined;
      if (validId) {
        try {
          latest = (await getMessages(id, lastId)).filter((m) => m.agent_id).at(-1);
        } catch (e) {
          console.error(e instanceof Error ? e.message : e);
        }
      }
      try {
        sources = await sourcesOf(reply.contents, latest);
      } catch (e) {
        console.error(e instanceof Error ? e.message : e);
      }
    }

    return Response.json({
      chatId: validId ? id : null,
      message: reply.message,
      sources,
      turnsLeft: Math.max(0, MAX_TURNS - usedTurns - 1),
    } satisfies AskResponse);
  } catch (e) {
    // 원문 에러는 서버 로그에만 (상태 코드와 경로만 담겨 있다)
    console.error(e instanceof Error ? e.message : e);
    if (e instanceof OnttleError && (e.status === 401 || e.status === 403)) return fail("config", 502);
    return fail("failed", 502);
  }
}

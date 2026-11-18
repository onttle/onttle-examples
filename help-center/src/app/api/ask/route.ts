import type { AskError, AskResponse, AskSource } from "@/lib/ask-types";
import {
  getMessages,
  listFaqs,
  OnttleError,
  sendMessage,
  startChat,
  type ChatMessage,
  type ContentRef,
  type Faq,
} from "@/lib/onttle";

/**
 * Browser → POST /help-center/api/ask { message, chatId? }
 * The key lives only here (on the server). This is a public demo, so the server limits message length and turns per chat.
 *
 * 1. With a chatId, read the history, check the turn limit by counting AI replies, and remember the last message id.
 * 2. POST /chats or /chats/{chatId}/messages → read the text/plain stream to the end and parse it as one JSON object.
 * 3. Sources: the stream's contents are only { id, table_id }, and so is the history (as observed in real responses),
 *    so the question and slug come from the cached FAQ list. Scores come from the history (GET ?lastId=) connections.
 */

// The history GET returns at most 20 messages → one user + one AI message per turn, so one read can count up to 9 turns.
const MAX_TURNS = Math.min(Number(process.env.ASK_MAX_TURNS) || 6, 9);
const MAX_LENGTH = Number(process.env.ASK_MAX_MESSAGE_LENGTH) || 300;
const CHAT_ID = /^[\w-]{1,100}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(error: AskError, status: number) {
  return Response.json({ error } satisfies AskResponse, { status });
}

/**
 * Sources = the stream's contents (what the answer actually referenced; 1–2 items in practice).
 * The history connections hold every search candidate (up to count), including unrelated FAQs, so only scores are taken from them.
 * score arrived as a string ("0.5256…") in real responses → convert it to a number.
 * For the same FAQ, the stream's contents.id is a slug while the history connections' contents.id is a content UUID (observed).
 * So both sides are resolved to the FAQ record first and matched by faq.id.
 * In follow-up answers the stream's contents.id has been a value that is not an FAQ identifier (a category value UUID, the order number "41")
 * → when none resolve to an FAQ, use the top-scoring candidate from the history as the source.
 */
async function sourcesOf(refs: ContentRef[], latest: ChatMessage | undefined): Promise<AskSource[]> {
  const faqs = await listFaqs();
  const byKey = new Map(faqs.flatMap((f) => [[f.id, f] as const, ...(f.slug ? [[f.slug, f] as const] : [])]));

  const scores = new Map<string, number>(); // faq.id → score
  let best: { faq: Faq; score: number } | undefined;
  for (const c of latest?.chat_messages_contents_connections ?? []) {
    const faq = byKey.get(c.contents.id);
    const score = Number(c.score);
    if (!faq || !Number.isFinite(score)) continue;
    scores.set(faq.id, score);
    if (!best || score > best.score) best = { faq, score };
  }

  const seen = new Set<string>();
  const sources: AskSource[] = [];
  for (const ref of refs) {
    const faq = byKey.get(ref.id);
    if (!faq || seen.has(faq.id)) continue; // do not link contents that are not in the published list
    seen.add(faq.id);
    sources.push({ slug: faq.slug ?? faq.id, question: faq.data.question, score: scores.get(faq.id) ?? null });
  }
  if (sources.length === 0 && refs.length > 0 && best) {
    sources.push({ slug: best.faq.slug ?? best.faq.id, question: best.faq.data.question, score: best.score });
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

    // Once, the stream's chatId arrived cut to 34 characters and every later call returned 500 (see BUILD_LOG).
    // Drop such an id and return the answer only → the next question starts a new chat.
    const validId = UUID.test(id);
    if (!validId) console.error(`Onttle chat stream returned a malformed chatId (length ${id.length})`);

    // Sources: scores from the history, or the stream's contents alone without it. The answer is returned even if this fails.
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
    // The raw error goes to the server log only (it holds just the status code and path)
    console.error(e instanceof Error ? e.message : e);
    if (e instanceof OnttleError && (e.status === 401 || e.status === 403)) return fail("config", 502);
    return fail("failed", 502);
  }
}

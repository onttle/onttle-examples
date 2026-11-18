import "server-only";

import { cacheLife, cacheTag } from "next/cache";

/**
 * Onttle REST API 호출을 한곳에 모은 모듈.
 * - 서버 전용: 클라이언트 컴포넌트에서 import하면 빌드가 실패한다 (server-only).
 * - 경로·필드는 002-help-center 프로젝트의 OpenAPI 명세와 Onttle 문서(Chats, 카테고리) 기준:
 *   GET  /tables/{table}?page&size&sort        FAQ 목록 (발행된 것만)
 *   GET  /tables/{table}/{id}                  FAQ 단건 ({id}는 content id 또는 slug)
 *   POST /tables/{table}/embeddings            의미 검색 (시크릿 키)
 *   GET  /categories                           카테고리와 값 (저장 순서)
 *   POST /chats                                새 대화 (text/plain 스트림 → 이어 붙이면 JSON)
 *   POST /chats/{chatId}/messages              대화 이어가기 (같은 형식)
 *   GET  /chats/{chatId}/messages?lastId=      메시지 이력 (최대 20개, 참조 콘텐츠·점수 포함)
 *   faqs 테이블은 slug가 없어 {table} 자리에 테이블 ID를 쓴다 (ONTTLE_FAQ_TABLE_ID).
 */

// ---------- 타입 (Onttle TypeScript 메뉴의 FaqsResponse를 옮긴 것) ----------

export interface Category {
  id: string;
  name: string;
}

export interface Faq {
  id: string;
  slug: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  data: {
    question: string;
    /** TEXT(textarea) 컬럼에 마크다운으로 저장 */
    answer: string | null;
    topic: Category | null;
    /** TEXT(multiple) 컬럼 */
    keywords: string[] | null;
    order: number | null;
  };
}

export type ScoredFaq = Faq & { score: number };

// ---------- 공통 fetch ----------

export class OnttleError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "OnttleError";
  }
}

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

function config() {
  // https://api.onttle.com 과 https://api.onttle.com/v1 둘 다 받는다
  const apiUrl = (process.env.ONTTLE_API_URL ?? "https://api.onttle.com").replace(/\/+$/, "").replace(/\/v1$/, "");
  return { base: `${apiUrl}/v1/${env("ONTTLE_PROJECT_ID")}`, apiKey: env("ONTTLE_API_KEY") };
}

function faqTable() {
  return encodeURIComponent(env("ONTTLE_FAQ_TABLE_ID"));
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const { base, apiKey } = config();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    // 응답 본문·키는 로그나 화면에 남기지 않는다. 상태 코드와 경로만.
    throw new OnttleError(res.status, `Onttle ${init?.method ?? "GET"} ${path} → ${res.status}`);
  }
  return res;
}

async function onttle<T>(path: string, init?: RequestInit): Promise<T> {
  return (await (await request(path, init)).json()) as T;
}

interface ListResponse<T> {
  list: T[];
  pagination: { page: number; size: number; total: number; totalPages: number };
}

// ---------- FAQ 목록·단건 (캐시: 5분 + "faqs" 태그로 즉시 무효화) ----------

/**
 * 발행된 FAQ 전부, order 오름차순.
 * 실제 API에서 확인한 것 (BUILD_LOG 참고):
 * - 명세는 size 최대 1000이지만 100·1000을 보내면 50으로 돌아온다 → 50씩, 응답의 totalPages까지 돈다.
 * - sort는 created_at 같은 기본 필드에만 먹고 사용자 컬럼(order)은 무시된다 → 서버에서 정렬한다.
 */
export async function listFaqs(): Promise<Faq[]> {
  "use cache";
  cacheTag("faqs");
  cacheLife({ revalidate: 300 });

  const all: Faq[] = [];
  for (let page = 1; ; page++) {
    const params = new URLSearchParams({ page: String(page), size: "50" });
    const res = await onttle<ListResponse<Faq>>(`/tables/${faqTable()}?${params}`);
    all.push(...res.list);
    if (res.list.length === 0 || page >= res.pagination.totalPages) break;
  }
  return all.sort((a, b) => (a.data.order ?? Infinity) - (b.data.order ?? Infinity));
}

export async function getFaq(slug: string): Promise<Faq | null> {
  "use cache";
  cacheTag("faqs", `faq:${slug}`);
  cacheLife({ revalidate: 300 });

  try {
    return await onttle<Faq>(`/tables/${faqTable()}/${encodeURIComponent(slug)}`);
  } catch (e) {
    if (e instanceof OnttleError && e.status === 404) return null;
    throw e;
  }
}

interface CategoryGroup {
  id: string;
  name: string;
  description: string | null;
  categories_values: Category[];
}

/** topic 카테고리의 값 목록 (대시보드에 저장한 순서). */
export async function listTopics(): Promise<Category[]> {
  "use cache";
  cacheTag("faqs");
  cacheLife({ revalidate: 300 });

  const groups = await onttle<CategoryGroup[]>("/categories");
  return groups.find((g) => g.name === "topic")?.categories_values ?? [];
}

// ---------- 의미 검색 (Embeddings, 시크릿 키 → 서버에서만, 캐시하지 않음) ----------

/**
 * 한글 구어체 질문은 정답 FAQ도 0.3~0.4대로 나오고, 상관없는 질문("오늘 날씨")도 0.32까지 나온다.
 * 0.35로 두어 잡음은 숨기고, 결과가 없으면 AI 질문으로 안내한다 (BUILD_LOG의 측정값).
 */
export const SEARCH_THRESHOLD = 0.35;

export async function searchFaqs(query: string): Promise<ScoredFaq[]> {
  const res = await onttle<{ list: ScoredFaq[] }>(`/tables/${faqTable()}/embeddings`, {
    method: "POST",
    body: JSON.stringify({ query, threshold: SEARCH_THRESHOLD, count: 10 }),
  });
  // 임베딩은 Vector 동기화 시점 기준이라, 지금 발행 목록에 있는 FAQ만 남긴다.
  const published = new Set((await listFaqs()).map((f) => f.id));
  return res.list.filter((f) => published.has(f.id));
}

// ---------- Chats (시크릿 키 → 서버에서만, 캐시하지 않음) ----------

const SEARCH_TYPES = ["vector", "query", "hybrid", "bm25"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

function searchType(): SearchType {
  const value = process.env.ASK_SEARCH_TYPE;
  return SEARCH_TYPES.find((t) => t === value) ?? "hybrid";
}

/** 스트림 응답을 이어 붙인 결과. 새 대화에는 chatId, 이어가기에는 chatMessageId가 온다 (Chats 문서). */
export interface ChatReply {
  chatId?: string;
  chatMessageId?: string;
  message: string;
  contents: ContentRef[];
}

/**
 * Chats 검색 최소 점수. 기본 0.7이면 "돈 돌려받고 싶어요" 같은 구어체 질문(정답 FAQ 0.39)이
 * 근거를 하나도 못 찾는다. 0.3에서도 "오늘 날씨" 같은 질문은 Agent가 모른다고 답했다 (BUILD_LOG).
 */
export const CHAT_THRESHOLD = 0.3;

function chatBody(message: string) {
  return JSON.stringify({
    agent_id: env("ONTTLE_AGENT_ID"),
    message,
    tableIds: [env("ONTTLE_FAQ_TABLE_ID")],
    search_type: searchType(),
    threshold: CHAT_THRESHOLD,
    count: 5,
  });
}

/** text/plain 스트림을 끝까지 읽어 하나의 JSON으로. SSE도, res.json()도 아니다. */
async function readChatStream(res: Response): Promise<ChatReply> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
  }
  raw += decoder.decode();
  return JSON.parse(raw) as ChatReply;
}

export async function startChat(message: string): Promise<ChatReply> {
  return readChatStream(await request("/chats", { method: "POST", body: chatBody(message) }));
}

export async function sendMessage(chatId: string, message: string): Promise<ChatReply> {
  return readChatStream(
    await request(`/chats/${encodeURIComponent(chatId)}/messages`, { method: "POST", body: chatBody(message) }),
  );
}

/** 참조 콘텐츠. 실측: 스트림 contents의 id는 slug, 이력 connections의 id는 content UUID (BUILD_LOG). 둘 다 받는다. */
export interface ContentRef {
  id: string;
  table_id: string;
}

export interface ChatMessage {
  id: string;
  created_at: string;
  /** null이면 사용자 메시지, 값이 있으면 AI 답변 */
  agent_id: string | null;
  message: string;
  /** 문서에는 contents에 slug·title·data가 있다고 나오지만, 실제로는 { id, table_id }뿐이었다 */
  /** score는 실제로 문자열로 왔다 (문서 예시는 숫자) */
  chat_messages_contents_connections: { id: string; order: number; score: number | string; contents: ContentRef }[];
}

/** 오래된 순 최대 20개. lastId를 주면 그 뒤에 생긴 메시지만. */
export async function getMessages(chatId: string, lastId?: string): Promise<ChatMessage[]> {
  const query = lastId ? `?${new URLSearchParams({ lastId })}` : "";
  const res = await onttle<{ data: ChatMessage[] }>(`/chats/${encodeURIComponent(chatId)}/messages${query}`);
  return res.data;
}

// ---------- 표시용 헬퍼 ----------

export function faqHref(faq: { slug: string | null; id: string }) {
  return `/faq/${encodeURIComponent(faq.slug ?? faq.id)}`;
}

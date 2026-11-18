import "server-only";

import { cacheLife, cacheTag } from "next/cache";

/**
 * All Onttle REST API calls live in this module.
 * - Server only: importing it from a client component fails the build (server-only).
 * - Paths and fields follow the 002-help-center project's OpenAPI spec and the Onttle docs (Chats, Categories):
 *   GET  /tables/{table}?page&size&sort        FAQ list (published only)
 *   GET  /tables/{table}/{id}                  single FAQ ({id} is a content id or slug)
 *   POST /tables/{table}/embeddings            semantic search (secret key)
 *   GET  /categories                           categories and their values (stored order)
 *   POST /chats                                new chat (text/plain stream → concatenated, it is JSON)
 *   POST /chats/{chatId}/messages              continue a chat (same format)
 *   GET  /chats/{chatId}/messages?lastId=      message history (up to 20, with referenced contents and scores)
 *   The faqs table has no slug, so the table ID goes in {table} (ONTTLE_FAQ_TABLE_ID).
 */

// ---------- Types (copied from FaqsResponse in Onttle's TypeScript menu) ----------

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
    /** Stored as Markdown in a TEXT (textarea) column */
    answer: string | null;
    topic: Category | null;
    /** TEXT (multiple) column */
    keywords: string[] | null;
    order: number | null;
  };
}

export type ScoredFaq = Faq & { score: number };

// ---------- Shared fetch ----------

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
  // Accepts both https://api.onttle.com and https://api.onttle.com/v1
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
    // Never log or show the response body or the key. Status code and path only.
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

// ---------- FAQ list and single item (cache: 5 minutes + instant invalidation with the "faqs" tag) ----------

/**
 * All published FAQs, in ascending order.
 * Observed on the real API (see BUILD_LOG):
 * - The spec says size goes up to 1000, but 100 and 1000 come back as 50 → request 50 at a time up to the response's totalPages.
 * - sort only works on built-in fields such as created_at and is ignored for user columns (order) → sort on the server.
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

/** Values of the topic category (in the order stored in the dashboard). */
export async function listTopics(): Promise<Category[]> {
  "use cache";
  cacheTag("faqs");
  cacheLife({ revalidate: 300 });

  const groups = await onttle<CategoryGroup[]>("/categories");
  return groups.find((g) => g.name === "topic")?.categories_values ?? [];
}

// ---------- Semantic search (Embeddings, secret key → server only, not cached) ----------

/**
 * Measured with the English FAQs: the right FAQ scored 0.56 or higher for 8 of 8 test questions,
 * and unrelated questions ("pasta recipe") stayed at 0.24 or lower. 0.4 sits between the two.
 * With no results the page points to Ask AI (measurements in BUILD_LOG).
 */
export const SEARCH_THRESHOLD = 0.4;

export async function searchFaqs(query: string): Promise<ScoredFaq[]> {
  const res = await onttle<{ list: ScoredFaq[] }>(`/tables/${faqTable()}/embeddings`, {
    method: "POST",
    body: JSON.stringify({ query, threshold: SEARCH_THRESHOLD, count: 10 }),
  });
  // Embeddings reflect the last Vector sync, so keep only FAQs that are in the published list now.
  const published = new Set((await listFaqs()).map((f) => f.id));
  return res.list.filter((f) => published.has(f.id));
}

// ---------- Chats (secret key → server only, not cached) ----------

const SEARCH_TYPES = ["vector", "query", "hybrid", "bm25"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

function searchType(): SearchType {
  const value = process.env.ASK_SEARCH_TYPE;
  return SEARCH_TYPES.find((t) => t === value) ?? "hybrid";
}

/** The concatenated stream response. A new chat carries chatId, a follow-up carries chatMessageId (Chats docs). */
export interface ChatReply {
  chatId?: string;
  chatMessageId?: string;
  message: string;
  contents: ContentRef[];
}

/**
 * Minimum score for Chats retrieval. At the default 0.7 a colloquial question such as "I want my money back"
 * (right FAQ: 0.56) finds no grounding at all. At 0.4 it is answered from the refund FAQ, and the Agent still
 * says it does not know for questions like "what is the weather today" (see BUILD_LOG).
 */
export const CHAT_THRESHOLD = 0.4;

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

/** Reads the text/plain stream to the end and parses it as one JSON object. It is neither SSE nor res.json(). */
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

/** A referenced content. Observed: the id is a slug in the stream's contents and a content UUID in the history connections (see BUILD_LOG). Both are accepted. */
export interface ContentRef {
  id: string;
  table_id: string;
}

export interface ChatMessage {
  id: string;
  created_at: string;
  /** null for a user message, set for an AI reply */
  agent_id: string | null;
  message: string;
  /** The docs show slug, title and data on contents, but real responses had only { id, table_id } */
  /** score actually arrived as a string (the docs example shows a number) */
  chat_messages_contents_connections: { id: string; order: number; score: number | string; contents: ContentRef }[];
}

/** Oldest first, up to 20. With lastId, only messages created after it. */
export async function getMessages(chatId: string, lastId?: string): Promise<ChatMessage[]> {
  const query = lastId ? `?${new URLSearchParams({ lastId })}` : "";
  const res = await onttle<{ data: ChatMessage[] }>(`/chats/${encodeURIComponent(chatId)}/messages${query}`);
  return res.data;
}

// ---------- Display helpers ----------

export function faqHref(faq: { slug: string | null; id: string }) {
  return `/faq/${encodeURIComponent(faq.slug ?? faq.id)}`;
}

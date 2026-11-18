import "server-only";

import { cacheLife, cacheTag } from "next/cache";

/**
 * Onttle REST API 호출을 한곳에 모은 모듈.
 * - 서버 전용: 클라이언트 컴포넌트에서 import하면 빌드가 실패한다 (server-only).
 * - 경로·파라미터는 프로젝트 OpenAPI 명세 기준:
 *   GET  /tables/{table}?page&size&sort&filter   목록 (발행된 글만 반환)
 *   GET  /tables/{table}/{id}                    단건 ({id}는 content id 또는 slug)
 *   POST /tables/{table}/bm25                    키워드 검색 (시크릿 키 필요)
 */

export const POSTS_TABLE = "posts";
export const PAGE_SIZE = 10;

// ---------- 타입 (Onttle TypeScript 메뉴의 PostsResponse를 옮긴 것) ----------

export interface ProjectFile {
  id: string;
  name: string;
  description: string | null;
  meta: { width: number | null; height: number | null; type: string };
  s3_path: string;
  presigned_url: string;
}

export interface Post {
  id: string;
  slug: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  data: {
    title: string;
    excerpt: string | null;
    /** TEXT(textarea) 컬럼에 마크다운으로 저장 */
    body: string | null;
    cover_image: ProjectFile | null;
    /** TEXT(multiple) 컬럼: 태그 이름 배열 */
    tags: string[] | null;
  };
}

export interface Pagination {
  page: number;
  total: number;
  totalPages: number;
}

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

function config() {
  const apiUrl = process.env.ONTTLE_API_URL ?? "https://api.onttle.com";
  const projectId = process.env.ONTTLE_PROJECT_ID;
  const apiKey = process.env.ONTTLE_API_KEY;
  if (!projectId || !apiKey) {
    throw new Error("ONTTLE_PROJECT_ID and ONTTLE_API_KEY must be set");
  }
  return { base: `${apiUrl.replace(/\/$/, "")}/v1/${projectId}`, apiKey };
}

async function onttle<T>(path: string, init?: RequestInit): Promise<T> {
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
  return (await res.json()) as T;
}

interface ListResponse<T> {
  list: T[];
  pagination: { page: number; total: number; size?: number; limit?: number; totalPages?: number };
}

function listQuery(page: number, size: number) {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sort: JSON.stringify([{ i: "published_at", o: "desc" }]),
  });
  return params.toString();
}

// ---------- 조회 함수 (캐시: 5분 + "posts" 태그로 즉시 무효화) ----------

export async function listPosts(page = 1): Promise<{ posts: Post[]; pagination: Pagination }> {
  "use cache";
  cacheTag("posts");
  cacheLife({ revalidate: 300 });

  const res = await onttle<ListResponse<Post>>(`/tables/${POSTS_TABLE}?${listQuery(page, PAGE_SIZE)}`);
  const total = res.pagination.total;
  return {
    posts: res.list,
    pagination: { page, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
  };
}

/** 모든 발행 글. 페이지를 끝까지 돌며 모은다 (generateStaticParams·태그 페이지용). */
export async function listAllPosts(): Promise<Post[]> {
  "use cache";
  cacheTag("posts");
  cacheLife({ revalidate: 300 });

  const size = 100;
  const all: Post[] = [];
  for (let page = 1; ; page++) {
    const res = await onttle<ListResponse<Post>>(`/tables/${POSTS_TABLE}?${listQuery(page, size)}`);
    all.push(...res.list);
    if (res.list.length < size || all.length >= res.pagination.total) break;
  }
  return all;
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  "use cache";
  cacheTag("posts", `post:${slug}`);
  cacheLife({ revalidate: 300 });

  try {
    return await onttle<Post>(`/tables/${POSTS_TABLE}/${encodeURIComponent(slug)}`);
  } catch (e) {
    if (e instanceof OnttleError && e.status === 404) return null;
    throw e;
  }
}

export interface Tag {
  name: string;
  count: number;
}

/** 발행 글에 실제로 달린 태그와 글 수. */
export async function listTags(): Promise<Tag[]> {
  const posts = await listAllPosts();
  const counts = new Map<string, number>();
  for (const p of posts) for (const t of p.data.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

export async function listPostsByTag(tag: string): Promise<Post[]> {
  const posts = await listAllPosts();
  return posts.filter((p) => p.data.tags?.includes(tag));
}

// ---------- 검색 (BM25, 시크릿 키 필요 → 서버에서만) ----------

interface Bm25Response {
  list: (Post & { score: number; bm25_score: number })[];
  reranked: boolean;
}

export async function searchPosts(query: string): Promise<Post[]> {
  "use cache";
  cacheTag("posts", "search");
  cacheLife({ revalidate: 300 });

  const res = await onttle<Bm25Response>(`/tables/${POSTS_TABLE}/bm25`, {
    method: "POST",
    // rerank: false → AI 토큰을 쓰지 않는 순수 키워드 검색
    body: JSON.stringify({ query, count: 20, rerank: false }),
  });
  // 검색은 Vector 동기화된 텍스트 기준이라, 발행 목록에 있는 글만 남긴다.
  const published = new Set((await listAllPosts()).map((p) => p.id));
  return res.list.filter((p) => published.has(p.id));
}

// ---------- 표시용 헬퍼 ----------

export function postHref(post: Post) {
  return `/posts/${encodeURIComponent(post.slug ?? post.id)}`;
}

export function coverUrl(post: Post): string | null {
  return post.data.cover_image?.s3_path ?? null;
}

export function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "Asia/Seoul" }).format(new Date(iso));
}

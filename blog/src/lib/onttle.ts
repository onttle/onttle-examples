import "server-only";

import { cacheLife, cacheTag } from "next/cache";

/**
 * All Onttle REST API calls live in this module.
 * - Server only: importing it from a client component fails the build (server-only).
 * - Paths and parameters follow the project's OpenAPI spec:
 *   GET  /tables/{table}?page&size&sort&filter   list (published posts only)
 *   GET  /tables/{table}/{id}                    single item ({id} is a content id or slug)
 *   POST /tables/{table}/bm25                    keyword search (needs a secret key)
 */

export const POSTS_TABLE = "posts";
export const PAGE_SIZE = 10;

// ---------- Types (copied from PostsResponse in Onttle's TypeScript menu) ----------

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
    /** Stored as Markdown in a TEXT (textarea) column */
    body: string | null;
    cover_image: ProjectFile | null;
    /** TEXT (multiple) column: array of tag names */
    tags: string[] | null;
  };
}

export interface Pagination {
  page: number;
  total: number;
  totalPages: number;
}

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
    // Never log or show the response body or the key. Status code and path only.
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

// ---------- Read functions (cache: 5 minutes + instant invalidation with the "posts" tag) ----------

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

/** All published posts, collected page by page (for generateStaticParams and tag pages). */
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

/** Tags actually used on published posts, with post counts. */
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

// ---------- Search (BM25, needs a secret key → server only) ----------

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
    // rerank: false → pure keyword search that uses no AI tokens
    body: JSON.stringify({ query, count: 20, rerank: false }),
  });
  // Search runs on Vector-synced text, so keep only posts that are in the published list.
  const published = new Set((await listAllPosts()).map((p) => p.id));
  return res.list.filter((p) => published.has(p.id));
}

// ---------- Display helpers ----------

export function postHref(post: Post) {
  return `/posts/${encodeURIComponent(post.slug ?? post.id)}`;
}

export function coverUrl(post: Post): string | null {
  return post.data.cover_image?.s3_path ?? null;
}

export function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "Asia/Seoul" }).format(new Date(iso));
}

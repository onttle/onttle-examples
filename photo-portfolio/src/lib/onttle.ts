import "server-only";

import { cacheLife, cacheTag } from "next/cache";

/**
 * All Onttle REST API calls live in this module.
 * - Server only: importing it from a client component fails the build (server-only).
 * - Every call sends the secret key (sk-proj_…) in X-Onttle-Key. The browser never calls Onttle.
 * - Paths and bodies follow the 006-photo-portfolio project's OpenAPI spec:
 *   GET  /tables/photos              { list, pagination }; data.image is a ProjectFile
 *   POST /tables/photos/embeddings   { query, threshold, count } → { list: [...row, score] }
 *   POST /tables/photos/bm25         { query, count, rerank } → { list: [...row, score, bm25_score], reranked }
 *   GET  /categories                 [{ id, name, categories_values: [{ id, name }] }]
 * - Signed image URLs (presigned_url) expire: 300 seconds (X-Amz-Expires=300) as measured on 2026-11-25. The list is
 *   cached for at most half of the time the URLs have left, read from the URLs themselves (see urlLifetime). That is
 *   shorter than a prerender may keep, so every page that shows photos renders at request time inside <Suspense>,
 *   from this cache. Nothing stores a URL anywhere else.
 */

export const PHOTOS_TAG = "photos";

/** Used when no expiry can be read from the URLs. */
const FALLBACK_URL_LIFETIME = 20 * 60;

// ---------- Shared fetch ----------

export class OnttleError extends Error {
  constructor(
    public status: number,
    public type: string | null,
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

function base() {
  // Accepts both https://api.onttle.com and https://api.onttle.com/v1
  const apiUrl = (process.env.ONTTLE_API_URL ?? "https://api.onttle.com").replace(/\/+$/, "").replace(/\/v1$/, "");
  return `${apiUrl}/v1/${env("ONTTLE_PROJECT_ID")}`;
}

const photosTable = () => encodeURIComponent(process.env.ONTTLE_PHOTOS_TABLE || "photos");

async function onttle<T>(
  path: string,
  { method = "GET", body, timeoutMs }: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const headers: Record<string, string> = { "X-Onttle-Key": env("ONTTLE_API_KEY") };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${base()}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
  });

  if (!res.ok) {
    // Only the error type is read. Never log the body or the key: status, method and path only.
    const err = (await res.json().catch(() => null)) as { type?: string } | null;
    throw new OnttleError(res.status, err?.type ?? null, `Onttle ${method} ${path.split("?")[0]} → ${res.status}`);
  }
  return (await res.json()) as T;
}

interface ListResponse<T> {
  list: T[];
  pagination: { page: number; size: number; total: number; totalPages: number };
}

/** Reads every page, 100 rows (the maximum `size`) at a time, until totalPages. */
async function readAll<T>(path: string): Promise<T[]> {
  const all: T[] = [];
  const sep = path.includes("?") ? "&" : "?";
  for (let page = 1; ; page++) {
    const res = await onttle<ListResponse<T>>(`${path}${sep}page=${page}&size=100`);
    all.push(...res.list);
    if (res.list.length === 0 || page >= res.pagination.totalPages) break;
  }
  return all;
}

// ---------- Types (ProjectFile and Category from the spec) ----------

export interface Category {
  id: string;
  name: string;
}

interface Thumbnail {
  path?: string;
  presigned_url?: string;
  size?: string;
  width?: number;
  height?: number;
}

interface ProjectFile {
  id: string;
  name?: string;
  description?: string | null;
  meta?: { width?: number; height?: number; [key: string]: unknown };
  presigned_url?: string;
  thumbnails?: Thumbnail[];
  text_vision?: string | null;
  description_generated?: string | null;
  keywords?: string[] | null;
}

interface RawPhoto {
  id: string;
  slug: string | null;
  created_at: string;
  data: {
    title?: string | null;
    image?: ProjectFile | ProjectFile[] | null;
    caption?: string | null;
    shot_at?: string | null;
    location?: string | null;
    series?: Category | Category[] | null;
    featured?: boolean | null;
  };
}

export interface ImageSource {
  url: string;
  width: number;
}

export type AltSource = "caption" | "ai" | "title";

export interface Photo {
  id: string;
  slug: string;
  title: string;
  /** The caption a person wrote, or "" */
  caption: string;
  shotAt: string | null;
  location: string;
  series: Category | null;
  featured: boolean;
  /** Text for the alt attribute: caption → description_generated → title */
  alt: string;
  altSource: AltSource;
  image: {
    /** Smallest source wider than ~1000px, or the largest there is: the src fallback */
    src: string;
    /** Thumbnails (and the original) by width, ascending. Empty when the widths are unknown */
    sources: ImageSource[];
    width: number | null;
    height: number | null;
    descriptionGenerated: string;
    keywords: string[];
    textVision: string;
  };
}

// ---------- Mapping ----------

const first = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

/** Thumbnails by width, then the original as the widest source. Thumbnails without a URL or width are skipped. */
function buildSources(file: ProjectFile): ImageSource[] {
  const sources: ImageSource[] = [];
  for (const t of file.thumbnails ?? []) {
    if (t.presigned_url && t.width) sources.push({ url: t.presigned_url, width: t.width });
  }
  const originalWidth = Number(file.meta?.width) || 0;
  if (file.presigned_url && originalWidth && !sources.some((s) => s.width >= originalWidth)) {
    sources.push({ url: file.presigned_url, width: originalWidth });
  }
  return sources.sort((a, b) => a.width - b.width);
}

function toPhoto(row: RawPhoto): Photo | null {
  const file = first(row.data.image);
  // No detail URL without a slug, nothing to show without an image (or a URL for it).
  if (!row.slug || !file?.presigned_url) return null;

  const title = row.data.title?.trim() || "";
  const caption = row.data.caption?.trim() || "";
  const ai = file.description_generated?.trim() || "";
  const [alt, altSource]: [string, AltSource] = caption ? [caption, "caption"] : ai ? [ai, "ai"] : [title, "title"];

  const sources = buildSources(file);
  const fallback = sources.find((s) => s.width >= 1000) ?? sources.at(-1);
  const width = Number(file.meta?.width) || null;
  const height = Number(file.meta?.height) || null;

  return {
    id: row.id,
    slug: row.slug,
    title,
    caption,
    shotAt: row.data.shot_at ?? null,
    location: row.data.location?.trim() || "",
    series: first(row.data.series),
    featured: row.data.featured === true,
    alt,
    altSource,
    image: {
      src: fallback?.url ?? file.presigned_url,
      sources,
      width,
      height,
      descriptionGenerated: ai,
      keywords: (file.keywords ?? []).map((k) => k.trim()).filter(Boolean),
      textVision: file.text_vision?.trim() || "",
    },
  };
}

// ---------- Signed URL lifetime ----------

/**
 * Seconds until the URL stops working, read from the URL itself:
 * - S3 SigV4: X-Amz-Date (yyyyMMddTHHmmssZ) + X-Amz-Expires (seconds)
 * - Expires=<unix seconds> (CloudFront and others)
 * null when neither is there.
 */
export function secondsLeft(url: string, now = Date.now()): number | null {
  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    return null;
  }
  const amzDate = params.get("X-Amz-Date");
  const amzExpires = Number(params.get("X-Amz-Expires"));
  if (amzDate && amzExpires) {
    const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(amzDate);
    if (m) {
      const signedAt = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
      return Math.floor((signedAt + amzExpires * 1000 - now) / 1000);
    }
  }
  const expires = Number(params.get("Expires"));
  if (expires) return Math.floor(expires - now / 1000);
  return null;
}

/** The shortest time any URL of these photos has left. */
function urlLifetime(photos: Photo[]): number {
  let min: number | null = null;
  for (const p of photos) {
    for (const url of [p.image.src, ...p.image.sources.map((s) => s.url)]) {
      const left = secondsLeft(url);
      if (left !== null && (min === null || left < min)) min = left;
    }
  }
  return min ?? FALLBACK_URL_LIFETIME;
}

/**
 * Cache for half of the URL lifetime, and never past it (expire < lifetime). At least 60 seconds.
 * With 300-second URLs: revalidate 150 s, expire 270 s. Next.js treats an expire under 5 minutes as dynamic,
 * so callers render at request time (inside <Suspense>) and share this cache instead of prerendering.
 */
function cacheForUrls(photos: Photo[]) {
  const lifetime = urlLifetime(photos);
  const revalidate = Math.max(60, Math.floor(lifetime / 2));
  cacheLife({ stale: Math.min(revalidate, 300), revalidate, expire: Math.max(revalidate + 1, Math.floor(lifetime * 0.9)) });
}

// ---------- Photos ----------

/**
 * Every published photo with an image, newest shot first. Rows whose image is not connected yet are skipped.
 * The category filter is not used: 12 rows are filtered here (see listBySeries).
 */
export async function listPhotos(): Promise<Photo[]> {
  "use cache";
  cacheTag(PHOTOS_TAG);

  // `ko` is the project's only language code (set at creation); the content itself is written in English.
  const rows = await readAll<RawPhoto>(`/tables/${photosTable()}?language=ko`);
  const photos = rows
    .map(toPhoto)
    .filter((p): p is Photo => p !== null)
    .sort((a, b) => (b.shotAt ?? "").localeCompare(a.shotAt ?? "") || a.slug.localeCompare(b.slug));
  cacheForUrls(photos);
  return photos;
}

/** One photo by slug, from the same cached list (12 rows), so its URLs expire on the same clock. */
export async function getPhoto(slug: string): Promise<Photo | null> {
  return (await listPhotos()).find((p) => p.slug === slug) ?? null;
}

// ---------- Series ----------

interface CategoryGroup {
  id: string;
  name: string;
  categories_values: Category[];
}

/** The project's categories. Cached on their own: they hold no signed URL. */
async function getCategories(): Promise<CategoryGroup[]> {
  "use cache";
  cacheTag(PHOTOS_TAG);
  cacheLife({ revalidate: 600 });
  return onttle<CategoryGroup[]>("/categories");
}

/**
 * The category values that have at least one photo, in the order set in the dashboard.
 * Not a "use cache" function itself: it reads listPhotos(), whose cache life is short (see cacheForUrls).
 */
export async function listSeries(): Promise<Category[]> {
  const [groups, photos] = await Promise.all([getCategories(), listPhotos()]);
  const used = new Set(photos.map((p) => p.series?.id).filter(Boolean));
  const group = groups.find((g) => g.categories_values.some((v) => used.has(v.id)));
  return group ? group.categories_values.filter((v) => used.has(v.id)) : [];
}

export async function listBySeries(seriesId: string): Promise<Photo[]> {
  return (await listPhotos()).filter((p) => p.series?.id === seriesId);
}

// ---------- Search ----------

export type SearchMode = "semantic" | "keyword";

export interface SearchHit {
  photo: Photo;
  score: number;
}

const SEARCH_COUNT = 12;
/**
 * Spec default 0.7 finds too little in 12 photos; 0.3 returned almost all of them. In the 5-query test (BUILD_LOG)
 * the right photos scored 0.58–0.80 and the unrelated ones 0.37–0.51.
 */
const SEMANTIC_THRESHOLD = 0.5;
/** A visitor waits at most this long; after it the page says search is not working (search/page.tsx). */
const SEARCH_TIMEOUT_MS = 10_000;

/**
 * Not cached: every query is different and costs embedding (or reranker) tokens.
 * - semantic → POST /tables/photos/embeddings
 * - keyword  → POST /tables/photos/bm25 (rerank on, the spec's default)
 * Hits are matched to the cached list by id, so a hit without an image (or one not published) is dropped and
 * every image URL comes from the same place as the rest of the site.
 */
export async function searchPhotos(query: string, mode: SearchMode): Promise<SearchHit[]> {
  const path = `/tables/${photosTable()}/${mode === "semantic" ? "embeddings" : "bm25"}`;
  const body = mode === "semantic" ? { query, count: SEARCH_COUNT, threshold: SEMANTIC_THRESHOLD } : { query, count: SEARCH_COUNT };
  const [res, photos] = await Promise.all([
    onttle<{ list: { id: string; score?: number }[] }>(path, { method: "POST", body, timeoutMs: SEARCH_TIMEOUT_MS }),
    listPhotos(),
  ]);
  const byId = new Map(photos.map((p) => [p.id, p]));
  return res.list.flatMap((hit) => {
    const photo = byId.get(hit.id);
    return photo ? [{ photo, score: hit.score ?? 0 }] : [];
  });
}

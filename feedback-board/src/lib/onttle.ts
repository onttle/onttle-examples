import "server-only";

import { cacheLife, cacheTag } from "next/cache";

/**
 * All Onttle REST API calls live in this module.
 * - Server only: importing it from a client component fails the build (server-only).
 * - Every call sends the publishable key (pk-proj_…) in X-Onttle-Key. The browser never calls Onttle and
 *   never sees the key or a member token: tokens live in httpOnly cookies (src/lib/session.ts).
 * - Member calls add `Authorization: Bearer <member access token>` (spec: securitySchemes.memberAuth).
 * - Paths and bodies follow the 004-feedback-board project's OpenAPI spec. Shapes follow the real
 *   responses where they differ from the spec (see docs/BUILD_LOG.md):
 *   GET /tables/feedback          { list, pagination } — `size` is ignored (always 50), `filter` / `fields` too
 *   GET /tables/feedback/{id}     the row — an unknown id answers 200 with ANOTHER row, so the id is checked
 *   CATEGORY columns arrive as { id, name } (the spec says a uuid string); writes send the value id
 *   No owner / author member id comes back, so the app cannot tell who wrote a row (403 is handled instead)
 * - Public reads are cached for 60 seconds under the "feedback" tag; writes call updateTag (src/app/actions.ts).
 */

export const FEEDBACK_TAG = "feedback";
export const feedbackTag = (id: string) => `feedback:${id}`;

// ---------- Shared fetch ----------

/** Error codes from MemberAuthError (spec). Table errors have no code; then only the status is known. */
export type AuthErrorCode =
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_EMAIL_NOT_VERIFIED"
  | "AUTH_EMAIL_EXISTS"
  | "AUTH_EMAIL_WITHDRAWN"
  | "AUTH_SIGNUP_PAUSED"
  | "AUTH_MEMBER_SUSPENDED"
  | "AUTH_TOKEN_EXPIRED"
  | "AUTH_TOKEN_INVALID"
  | "AUTH_RATE_LIMITED"
  | "AUTH_FORBIDDEN"
  | "AUTH_NOT_ENABLED"
  | "AUTH_INVALID_REQUEST"
  | "AUTH_MEMBER_NOT_FOUND"
  | "AUTH_PROVIDER_NOT_SUPPORTED";

export class OnttleError extends Error {
  constructor(
    public status: number,
    public code: AuthErrorCode | null,
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

const table = () => encodeURIComponent(env("ONTTLE_FEEDBACK_TABLE"));

interface CallOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** Member access token. Requests that carry one are never cached. */
  token?: string;
}

async function onttle<T>(path: string, { method = "GET", body, token }: CallOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "X-Onttle-Key": env("ONTTLE_PUBLISHABLE_KEY") };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${base()}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    // Only the error code is read. Never log the body, the key or a token: status, method and path only.
    const err = (await res.json().catch(() => null)) as { code?: AuthErrorCode } | null;
    throw new OnttleError(res.status, err?.code ?? null, `Onttle ${method} ${path.split("?")[0]} → ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------- Feedback (table) ----------

export interface Category {
  id: string;
  name: string;
}

// Columns from the project's TypeScript (FeedbackResponse). progress is null on member posts:
// only the team changes it in the dashboard.
interface FeedbackData {
  title: string;
  body: string;
  kind: Category | null;
  progress: Category | null;
  author_name: string | null;
}

export interface Feedback {
  id: string;
  created_at: string;
  updated_at: string | null;
  published_at: string | null;
  data: FeedbackData;
}

interface ListResponse<T> {
  list: T[];
  pagination: { page: number; size: number; total: number; totalPages: number };
}

/** The real API sometimes returns a category as a one-item array (the MCP view does); accept both. */
function normalize(row: Feedback): Feedback {
  const one = (v: unknown) => (Array.isArray(v) ? ((v[0] as Category | undefined) ?? null) : ((v as Category | null) ?? null));
  return { ...row, data: { ...row.data, kind: one(row.data.kind), progress: one(row.data.progress) } };
}

/**
 * Every published row, newest first.
 * `size` is ignored by the API (always 50), so pages of 50 are read up to totalPages and the app pages
 * the list itself. `sort` is not relied on either: rows are sorted by created_at here.
 */
export async function listFeedback(): Promise<Feedback[]> {
  "use cache";
  cacheTag(FEEDBACK_TAG);
  cacheLife({ revalidate: 60 });

  const all: Feedback[] = [];
  for (let page = 1; ; page++) {
    const res = await onttle<ListResponse<Feedback>>(`/tables/${table()}?page=${page}&size=50`);
    all.push(...res.list.map(normalize));
    if (res.list.length === 0 || page >= res.pagination.totalPages) break;
  }
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** One row, or null. An unknown id comes back as some other row with 200, so the id must match. */
export async function getFeedback(id: string): Promise<Feedback | null> {
  "use cache";
  cacheTag(FEEDBACK_TAG, feedbackTag(id));
  cacheLife({ revalidate: 60 });

  try {
    const row = await onttle<Feedback>(`/tables/${table()}/${encodeURIComponent(id)}`);
    return row?.id === id ? normalize(row) : null;
  } catch (e) {
    if (e instanceof OnttleError && (e.status === 404 || e.status === 400)) return null;
    throw e;
  }
}

/** Name of the category behind the kind column, as created in the dashboard. */
const KIND_CATEGORY = "Feedback type";

/** The kind choices for the form (GET /categories works with a publishable key). */
export async function listKinds(): Promise<Category[]> {
  "use cache";
  cacheTag(FEEDBACK_TAG);
  cacheLife({ revalidate: 3600 });

  const categories = await onttle<{ id: string; name: string; categories_values: Category[] }[]>("/categories");
  return categories.find((c) => c.name === KIND_CATEGORY)?.categories_values ?? [];
}

export interface FeedbackInput {
  title: string;
  body: string;
  /** Category value id (uuid) */
  kind: string;
}

/**
 * Permission rule `member`: any signed-in member. The row's owner is the member whose token is sent.
 * is_publish: true — without it the row is saved as a draft and never shows in the public list.
 * progress is not sent: it is the team's column.
 */
export async function createFeedback(token: string, input: FeedbackInput & { author_name: string }): Promise<Feedback> {
  const row = await onttle<Feedback>(`/tables/${table()}`, {
    method: "POST",
    token,
    body: { ...input, is_publish: true },
  });
  return normalize(row);
}

/** Permission rule `owner`: another member's row → 403 AUTH_FORBIDDEN. Only title, body and kind are sent. */
export async function updateFeedback(token: string, id: string, input: FeedbackInput): Promise<void> {
  await onttle(`/tables/${table()}/${encodeURIComponent(id)}`, {
    method: "PUT",
    token,
    body: { ...input, is_publish: true },
  });
}

/** Permission rule `owner`. */
export async function deleteFeedback(token: string, id: string): Promise<void> {
  await onttle(`/tables/${table()}/${encodeURIComponent(id)}`, { method: "DELETE", token });
}

// ---------- Members (auth) ----------

export interface Member {
  id: string;
  email: string;
  role: string;
  status: "pending" | "active" | "suspended";
  emailVerified: boolean;
  /** Fields defined by the app. This example stores { name }. */
  profile: { name?: string } & Record<string, unknown>;
  createdAt: string;
  lastLoginAt: string | null;
}

/** Bearer mode (the project's token mode): both tokens arrive in the body. */
export interface MemberSession {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds */
  expiresIn: number;
  member: Member;
}

export interface Consent {
  type: "terms" | "privacy" | "marketing";
  version: string;
  agreed: boolean;
}

/** Creates a `pending` member and sends the verification e-mail (to the project's verify redirect URL). */
export async function signup(input: { email: string; password: string; name: string; consents: Consent[] }) {
  await onttle<{ member: Member }>("/auth/signup", {
    method: "POST",
    body: { email: input.email, password: input.password, profile: { name: input.name }, consents: input.consents },
  });
}

/** Idempotent: the same token can be sent again. 402 AUTH_SIGNUP_PAUSED keeps the member pending. */
export async function verifyEmail(token: string) {
  await onttle<{ member: Member }>("/auth/email/verify", { method: "POST", body: { token } });
}

/** Same answer whether or not the address belongs to a pending member. 1 per minute, 5 per day. */
export async function resendVerification(email: string) {
  await onttle<{ success: boolean }>("/auth/email/resend", { method: "POST", body: { email } });
}

export async function login(email: string, password: string): Promise<MemberSession> {
  return onttle<MemberSession>("/auth/login", { method: "POST", body: { email, password } });
}

/** Refresh tokens are single use: the one sent is revoked, and sending a used one signs out everywhere. */
export async function refreshSession(refreshToken: string): Promise<MemberSession> {
  return onttle<MemberSession>("/auth/token/refresh", { method: "POST", body: { refreshToken } });
}

export async function logout(token: string, refreshToken: string | undefined) {
  await onttle<{ success: boolean }>("/auth/logout", {
    method: "POST",
    token,
    body: refreshToken ? { refreshToken } : {},
  });
}

export async function getMe(token: string): Promise<Member> {
  const { member } = await onttle<{ member: Member }>("/me", { token });
  return member;
}

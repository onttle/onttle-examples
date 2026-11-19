import "server-only";

import { cacheLife, cacheTag } from "next/cache";

/**
 * All Onttle REST API calls live in this module.
 * - Server only: importing it from a client component fails the build (server-only).
 * - Every call sends the secret key (sk-proj_…) in X-Onttle-Key. The browser never calls Onttle.
 * - Paths and bodies follow the 005-event-rsvp project's OpenAPI spec:
 *   GET  /tables/events              { list, pagination }
 *   GET  /tables/events/{id}         the row, by slug
 *   GET  /tables/registrations       secret key only (read rule `none`)
 *   POST /tables/registrations       secret key only
 *   Where the real responses differ from the spec, the code follows the real ones (docs/BUILD_LOG.md).
 * - Registrations hold names and e-mail addresses. Nothing exported from here returns them:
 *   the seat functions return numbers, and the check before a write returns a count and one boolean.
 * - Events are cached for 60 seconds under "events", seat counts under "seats" and "seats:{eventId}".
 *   The RSVP action calls updateTag, the webhook calls revalidateTag, and because Onttle sends each
 *   webhook once with no retry, the 60-second revalidation stays as the fallback.
 */

export const EVENTS_TAG = "events";
export const SEATS_TAG = "seats";
export const seatsTag = (eventId: string) => `seats:${eventId}`;

// ---------- Shared fetch ----------

/** `type` values of the public REST API errors (docs: REST API → Error Codes). Only the ones handled here. */
export type OnttleErrorType = "invalidReferenceValue" | "insufficientCredit" | "invalidRequest" | "apiNotEnabled";

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

const eventsTable = () => encodeURIComponent(process.env.ONTTLE_EVENTS_TABLE || "events");
const registrationsTable = () => encodeURIComponent(process.env.ONTTLE_REGISTRATIONS_TABLE || "registrations");

async function onttle<T>(path: string, { method = "GET", body }: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { "X-Onttle-Key": env("ONTTLE_API_KEY") };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${base()}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
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
async function readAll<T>(table: string): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; ; page++) {
    const res = await onttle<ListResponse<T>>(`/tables/${table}?page=${page}&size=100`);
    all.push(...res.list);
    if (res.list.length === 0 || page >= res.pagination.totalPages) break;
  }
  return all;
}

// ---------- Events ----------

export interface Category {
  id: string;
  name: string;
}

interface RawEvent {
  id: string;
  slug: string | null;
  data: {
    title: string;
    summary: string | null;
    description: { html: string } | null;
    starts_at: string;
    venue: string | null;
    format: Category | Category[] | null;
    capacity: number;
    rsvp_open: boolean | null;
  };
}

export interface MeetupEvent {
  id: string;
  slug: string;
  title: string;
  summary: string;
  /** HTML made by Onttle from the EDITOR column. Written by the project's editors only. */
  descriptionHtml: string;
  /** ISO 8601 with an offset */
  startsAt: string;
  venue: string;
  format: Category | null;
  capacity: number;
  rsvpOpen: boolean;
}

/**
 * TIMESTAMP values are stored as wall-clock time ("2026-12-10 19:00:00", no zone). Makers' Night is a
 * Seoul meetup, so a value without a zone is read as KST. A value that already carries a zone is kept.
 */
function toIso(value: string): string {
  const wallClock = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/.exec(value);
  if (wallClock) return `${wallClock[1]}T${wallClock[2]}+09:00`;
  return value;
}

function toEvent(row: RawEvent): MeetupEvent | null {
  if (!row.slug) return null; // no detail URL without a slug
  const format = Array.isArray(row.data.format) ? (row.data.format[0] ?? null) : row.data.format;
  return {
    id: row.id,
    slug: row.slug,
    title: row.data.title,
    summary: row.data.summary ?? "",
    descriptionHtml: row.data.description?.html ?? "",
    startsAt: toIso(row.data.starts_at),
    venue: row.data.venue ?? "",
    format: format ?? null,
    capacity: row.data.capacity,
    rsvpOpen: row.data.rsvp_open !== false,
  };
}

/** Every published event. `sort` is not relied on: the callers sort by start time. */
export async function listEvents(): Promise<MeetupEvent[]> {
  "use cache";
  cacheTag(EVENTS_TAG);
  cacheLife({ revalidate: 60 });

  const rows = await readAll<RawEvent>(eventsTable());
  return rows.map(toEvent).filter((e): e is MeetupEvent => e !== null);
}

export interface Schedule {
  upcoming: MeetupEvent[];
  past: MeetupEvent[];
}

/** Upcoming events soonest first, past events latest first. "Now" is read inside the 60-second cache. */
export async function getSchedule(): Promise<Schedule> {
  "use cache";
  cacheTag(EVENTS_TAG);
  cacheLife({ revalidate: 60 });

  const events = await listEvents();
  const now = Date.now();
  const time = (e: MeetupEvent) => new Date(e.startsAt).getTime();
  return {
    upcoming: events.filter((e) => time(e) >= now).sort((a, b) => time(a) - time(b)),
    past: events.filter((e) => time(e) < now).sort((a, b) => time(b) - time(a)),
  };
}

async function fetchEvent(slug: string): Promise<MeetupEvent | null> {
  try {
    const row = await onttle<RawEvent>(`/tables/${eventsTable()}/${encodeURIComponent(slug)}`);
    // The path takes a slug or a content id. Only the slug is this site's URL, so the slug must match.
    return row?.slug === slug ? toEvent(row) : null;
  } catch (e) {
    if (e instanceof OnttleError && (e.status === 404 || e.status === 400)) return null;
    throw e;
  }
}

/** One event by slug, or null. */
export async function getEvent(slug: string): Promise<MeetupEvent | null> {
  "use cache";
  cacheTag(EVENTS_TAG);
  cacheLife({ revalidate: 60 });
  return fetchEvent(slug);
}

/** The same without the cache: the RSVP action checks capacity and rsvp_open as they are right now. */
export async function getEventFresh(slug: string): Promise<MeetupEvent | null> {
  return fetchEvent(slug);
}

// ---------- Registrations (personal data: never leaves this module) ----------

interface RawRegistration {
  id: string;
  created_at: string;
  data: { event: unknown; email?: string | null };
}

/**
 * The id of the referenced row. The REST API answers { tableId, uuid }; the MCP tools show the id as a
 * plain string. Both are handled (docs/BUILD_LOG.md).
 */
function referenceId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return referenceId(value[0]);
  if (value && typeof value === "object") {
    const ref = value as { uuid?: unknown; id?: unknown };
    if (typeof ref.uuid === "string") return ref.uuid;
    if (typeof ref.id === "string") return ref.id;
  }
  return null;
}

/** REFERENCE columns cannot be filtered (a filter on one is ignored), so every row is read and counted here. */
async function readRegistrations() {
  const rows = await readAll<RawRegistration>(registrationsTable());
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    eventId: referenceId(r.data.event),
    email: (r.data.email ?? "").trim().toLowerCase(),
  }));
}

/** Seats taken per event id. Numbers only. */
export async function countAllSeats(): Promise<Record<string, number>> {
  "use cache";
  cacheTag(SEATS_TAG);
  cacheLife({ revalidate: 60 });

  const counts: Record<string, number> = {};
  for (const r of await readRegistrations()) {
    if (r.eventId) counts[r.eventId] = (counts[r.eventId] ?? 0) + 1;
  }
  return counts;
}

/** Seats taken for one event. A number only. */
export async function countSeats(eventId: string): Promise<number> {
  "use cache";
  cacheTag(SEATS_TAG, seatsTag(eventId));
  cacheLife({ revalidate: 60 });

  return (await readRegistrations()).filter((r) => r.eventId === eventId).length;
}

/** Read without the cache just before a write: seats taken, and whether this e-mail is already in. */
export async function checkSeats(eventId: string, email: string): Promise<{ taken: number; alreadyRegistered: boolean }> {
  const rows = (await readRegistrations()).filter((r) => r.eventId === eventId);
  const needle = email.trim().toLowerCase();
  return { taken: rows.length, alreadyRegistered: rows.some((r) => r.email === needle) };
}

export interface RegistrationInput {
  /** Content id of the event row (REFERENCE takes the id string) */
  event: string;
  name: string;
  email: string;
  note?: string;
}

/**
 * Writes the RSVP, then counts again. Onttle has no transaction or conditional write, so two requests can
 * both pass the check for the last seat. `position` is this row's place in creation order: the caller
 * tells the visitor when it is beyond the seat limit. is_publish: true — otherwise the row is a draft
 * and the list (published rows only) would not count it.
 */
export async function createRegistration(input: RegistrationInput): Promise<{ position: number }> {
  const body: Record<string, unknown> = { event: input.event, name: input.name, email: input.email, is_publish: true };
  if (input.note) body.note = input.note;
  const created = await onttle<{ id: string }>(`/tables/${registrationsTable()}`, { method: "POST", body });

  const rows = (await readRegistrations())
    .filter((r) => r.eventId === input.event)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const index = rows.findIndex((r) => r.id === created.id);
  return { position: index === -1 ? rows.length : index + 1 };
}

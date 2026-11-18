import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { pick, type Locale, type Localized } from "@/i18n/locales";

/**
 * All Onttle REST API calls live in this module.
 * - Server only: importing it from a client component fails the build (server-only).
 * - Every call is a GET, so a publishable key (pk-proj_…) is enough. It is still read on the server only.
 * - Paths follow the 003-i18n-landing project's OpenAPI spec; shapes follow the real responses (see BUILD_LOG):
 *   GET /translations          array of { key, value: { en, ko } } — no pagination, {{var_key}} already replaced
 *   GET /variables             array of { key, value, description } — value keeps its type (number, string)
 *   GET /tables/{table}?page&size   { list, pagination } — localized columns arrive as { en, ko }
 *   The plans table has no slug, so table IDs go in {table} for both tables.
 * - Everything is cached for 5 minutes under the "landing" tag (POST /api/revalidate clears it at once).
 */

export const CACHE_TAG = "landing";

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

async function onttle<T>(path: string): Promise<T> {
  const { base, apiKey } = config();
  const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) {
    // Never log or show the response body or the key. Status code and path only.
    throw new OnttleError(res.status, `Onttle GET ${path} → ${res.status}`);
  }
  return (await res.json()) as T;
}

// ---------- Translations ----------

export interface Translation {
  key: string;
  /** One text per project language. A language left empty in the dashboard arrives as "". */
  value: Partial<Record<Locale, string>>;
}

export async function getTranslations(): Promise<Translation[]> {
  "use cache";
  cacheTag(CACHE_TAG);
  cacheLife({ revalidate: 300 });

  return onttle<Translation[]>("/translations");
}

// ---------- Variables ----------

interface Variable {
  key: string;
  value: unknown;
  description: string | null;
}

/** Variables as a { key: text } object, for values the page uses directly (signup_url). */
export async function getVariables(): Promise<Record<string, string>> {
  "use cache";
  cacheTag(CACHE_TAG);
  cacheLife({ revalidate: 300 });

  const list = await onttle<Variable[]>("/variables");
  return Object.fromEntries(list.filter((v) => v.value != null).map((v) => [v.key, String(v.value)]));
}

// ---------- Tables ----------

interface ListResponse<T> {
  list: T[];
  pagination: { page: number; size: number; total: number; totalPages: number };
}

interface Row<D> {
  id: string;
  data: D;
}

/**
 * All published rows of a table.
 * Observed on the real API (see BUILD_LOG): size above 50 comes back as 50 and sorting by a user
 * column is ignored → request 50 at a time up to totalPages and sort on the server.
 * `language` (spec) and `locale` (docs) do not change the response, so no language parameter is sent:
 * one cached response serves both locales and pick() chooses the text.
 */
async function listRows<D>(tableId: string): Promise<Row<D>[]> {
  "use cache";
  cacheTag(CACHE_TAG);
  cacheLife({ revalidate: 300 });

  const all: Row<D>[] = [];
  for (let page = 1; ; page++) {
    const params = new URLSearchParams({ page: String(page), size: "50" });
    const res = await onttle<ListResponse<Row<D>>>(`/tables/${encodeURIComponent(tableId)}?${params}`);
    all.push(...res.list);
    if (res.list.length === 0 || page >= res.pagination.totalPages) break;
  }
  return all;
}

function byOrder<T extends { order: number }>(a: T, b: T) {
  return a.order - b.order;
}

// Column names and types from FeaturesResponse / PlansResponse in the project's TypeScript menu.
interface FeatureData {
  title: Localized<string>;
  description: Localized<string> | null;
  icon: string | null;
  order: number | null;
}

export interface Feature {
  id: string;
  title: string;
  description: string;
  icon: string;
  order: number;
}

export async function listFeatures(locale: Locale): Promise<Feature[]> {
  const rows = await listRows<FeatureData>(env("ONTTLE_FEATURES_TABLE_ID"));
  return rows
    .map(({ id, data }) => ({
      id,
      title: pick(data.title, locale) ?? "",
      description: pick(data.description, locale) ?? "",
      icon: data.icon ?? "",
      order: data.order ?? Infinity,
    }))
    .sort(byOrder);
}

interface PlanData {
  name: Localized<string>;
  summary: Localized<string> | null;
  price_krw: number | null;
  price_usd: number | null;
  included: Localized<string[]> | null;
  is_popular: boolean | null;
  order: number | null;
}

export interface Plan {
  id: string;
  name: string;
  summary: string;
  priceKrw: number;
  priceUsd: number;
  included: string[];
  isPopular: boolean;
  order: number;
}

export async function listPlans(locale: Locale): Promise<Plan[]> {
  const rows = await listRows<PlanData>(env("ONTTLE_PLANS_TABLE_ID"));
  return rows
    .map(({ id, data }) => ({
      id,
      name: pick(data.name, locale) ?? "",
      summary: pick(data.summary, locale) ?? "",
      priceKrw: data.price_krw ?? 0,
      priceUsd: data.price_usd ?? 0,
      included: pick(data.included, locale) ?? [],
      isPopular: data.is_popular ?? false,
      order: data.order ?? Infinity,
    }))
    .sort(byOrder);
}

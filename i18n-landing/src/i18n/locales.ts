export const locales = ["ko", "en"] as const;
export type Locale = (typeof locales)[number];

/** Used for the root redirect and as the fallback language for missing texts. */
export const defaultLocale: Locale = "ko";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** A localized Onttle value: `{ ko, en }` in real responses, a plain value if the API ever resolves it. */
export type Localized<T> = T | Partial<Record<Locale, T>>;

function isLanguageMap<T>(value: Localized<T>): value is Partial<Record<Locale, T>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every(isLocale);
}

function isEmpty(value: unknown) {
  return value == null || value === "" || (Array.isArray(value) && value.length === 0);
}

/** Picks the text for a locale: locale → default locale → undefined. Handles both response shapes. */
export function pick<T>(value: Localized<T> | null | undefined, locale: Locale): T | undefined {
  if (value == null) return undefined;
  if (!isLanguageMap(value)) return value;
  const own = value[locale];
  if (!isEmpty(own)) return own;
  const fallback = value[defaultLocale];
  return isEmpty(fallback) ? undefined : fallback;
}

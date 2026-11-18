import { getTranslations, OnttleError, type Translation } from "@/lib/onttle";
import fallbackEn from "./fallback.en.json";
import fallbackKo from "./fallback.ko.json";
import { defaultLocale, type Locale } from "./locales";

export interface Messages {
  [key: string]: string | Messages;
}

const fallbacks: Record<Locale, Messages> = { ko: fallbackKo, en: fallbackEn };

/**
 * next-intl reads messages as ICU, so a brace left in a text would be parsed as an argument.
 * Onttle replaces {{var_key}} before responding, but a disabled variable can leave one behind.
 * No text in this example uses ICU arguments, so braces and apostrophes are escaped to show as written.
 */
function literal(text: string) {
  return text.replace(/'/g, "''").replace(/[{}]/g, "'$&'");
}

/** Writes "hero.title" into { hero: { title } }. next-intl treats dots as nesting, so a flat object would not be found. */
function setNested(target: Messages, key: string, text: string) {
  const parts = key.split(".");
  let node = target;
  for (const part of parts.slice(0, -1)) {
    const next = node[part];
    if (typeof next === "string") return; // "a" and "a.b" cannot both exist: keep the first
    node = next ?? (node[part] = {});
  }
  const last = parts[parts.length - 1];
  if (typeof node[last] !== "object") node[last] = text;
}

/** Text for a locale: locale → default locale (ko) → nothing (the bundled fallback or the key stays). */
function textFor(item: Translation, locale: Locale) {
  return item.value[locale] || item.value[defaultLocale] || undefined;
}

/**
 * Messages for next-intl, loaded from Onttle translations.
 * The bundled fallback is the base, so a failed call or a missing key never breaks the page or the build.
 */
export async function getMessages(locale: Locale): Promise<Messages> {
  const messages: Messages = structuredClone(fallbacks[locale]);
  try {
    for (const item of await getTranslations()) {
      const text = textFor(item, locale);
      if (text) setNested(messages, item.key, literal(text));
    }
  } catch (e) {
    // Status code only: never log the response body or the key.
    console.error(`[i18n] translations unavailable, using bundled fallback (${e instanceof OnttleError ? e.status : "error"})`);
  }
  return messages;
}

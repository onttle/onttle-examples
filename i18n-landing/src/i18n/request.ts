import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale } from "./locales";
import { getMessages } from "./messages";

/**
 * Every call site passes the locale explicitly (getTranslations({ locale })), so next-intl never reads
 * request headers and the pages can be prerendered with Cache Components.
 */
export default getRequestConfig(async ({ locale, requestLocale }) => {
  const requested = locale ?? (await requestLocale);
  const resolved = isLocale(requested) ? requested : defaultLocale;
  return { locale: resolved, messages: await getMessages(resolved), timeZone: "Asia/Seoul" };
});

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/icon";
import { isLocale, locales, type Locale } from "@/i18n/locales";
import { getVariables, listFeatures, listPlans, OnttleError } from "@/lib/onttle";

// Includes the basePath (e.g. https://example.onttle.com/i18n-landing)
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/i18n-landing").replace(/\/+$/, "");

/** A failed section is hidden instead of failing the page. Status code only in the log. */
async function orElse<T>(label: string, load: Promise<T>, fallback: T): Promise<T> {
  try {
    return await load;
  } catch (e) {
    console.error(`[landing] ${label} unavailable (${e instanceof OnttleError ? e.status : "error"})`);
    return fallback;
  }
}

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale });
  return {
    title: `Pageworks — ${t("hero.title")}`,
    description: t("hero.subtitle"),
    alternates: {
      canonical: `${siteUrl}/${locale}`,
      languages: Object.fromEntries(locales.map((l) => [l, `${siteUrl}/${l}`])),
    },
  };
}

function formatPrice(locale: Locale, plan: { priceKrw: number; priceUsd: number }) {
  return locale === "ko"
    ? new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(plan.priceKrw)
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(plan.priceUsd);
}

const primaryButton =
  "inline-block rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500";

export default async function LandingPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [t, variables, features, plans] = await Promise.all([
    getTranslations({ locale }),
    orElse("variables", getVariables(), {} as Record<string, string>),
    orElse("features", listFeatures(locale), []),
    orElse("plans", listPlans(locale), []),
  ]);
  const other: Locale = locale === "ko" ? "en" : "ko";
  // A fictional service, so the sign-up link points back to this page.
  const signupUrl = variables.signup_url ?? `${siteUrl}/${locale}`;

  return (
    <>
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <Link href={`/${locale}`} className="font-semibold">
            Pageworks
          </Link>
          <nav className="flex items-center gap-4 text-sm sm:gap-6">
            {features.length > 0 && (
              <a href="#features" className="hidden hover:underline sm:inline">
                {t("nav.features")}
              </a>
            )}
            {plans.length > 0 && (
              <a href="#pricing" className="hidden hover:underline sm:inline">
                {t("nav.pricing")}
              </a>
            )}
            <a href="#contact" className="hidden hover:underline sm:inline">
              {t("nav.contact")}
            </a>
            <Link
              href={`/${other}`}
              hrefLang={other}
              lang={other}
              className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              {t("lang.switch")}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 py-20 text-center sm:py-28">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            {t("hero.title")}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-neutral-600 dark:text-neutral-400">{t("hero.subtitle")}</p>
          <a href={signupUrl} className={`${primaryButton} mt-8`}>
            {t("hero.cta")}
          </a>
        </section>

        {features.length > 0 && (
          <section id="features" className="border-t border-neutral-200 dark:border-neutral-800">
            <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
              <h2 className="text-center text-2xl font-bold sm:text-3xl">{t("features.heading")}</h2>
              <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {features.map((feature) => (
                  <li key={feature.id} className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
                    <span className="inline-flex rounded-md bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                      <Icon name={feature.icon} className="size-5" />
                    </span>
                    <h3 className="mt-4 font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                      {feature.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {plans.length > 0 && (
          <section id="pricing" className="border-t border-neutral-200 dark:border-neutral-800">
            <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
              <h2 className="text-center text-2xl font-bold sm:text-3xl">{t("pricing.heading")}</h2>
              <ul className="mt-10 grid gap-6 md:grid-cols-3">
                {plans.map((plan) => {
                  const free = (locale === "ko" ? plan.priceKrw : plan.priceUsd) === 0;
                  return (
                    <li
                      key={plan.id}
                      className={`flex flex-col rounded-lg border p-6 ${
                        plan.isPopular
                          ? "border-indigo-600 ring-1 ring-indigo-600"
                          : "border-neutral-200 dark:border-neutral-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-lg font-semibold">{plan.name}</h3>
                        {plan.isPopular && (
                          <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-medium text-white">
                            {t("pricing.popular")}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{plan.summary}</p>
                      <p className="mt-6">
                        <span className="text-3xl font-bold">{free ? t("pricing.free") : formatPrice(locale, plan)}</span>
                        {!free && <span className="ml-1 text-sm text-neutral-500">{t("pricing.per_month")}</span>}
                      </p>
                      <ul className="mt-6 space-y-2 text-sm">
                        {plan.included.map((item) => (
                          <li key={item} className="flex gap-2">
                            <span aria-hidden="true" className="text-indigo-600 dark:text-indigo-400">
                              ✓
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        <section className="border-t border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:py-20">
            <h2 className="text-2xl font-bold sm:text-3xl">{t("cta.title")}</h2>
            <a href={signupUrl} className={`${primaryButton} mt-6`}>
              {t("cta.button")}
            </a>
          </div>
        </section>
      </main>

      <footer id="contact" className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-8 text-sm text-neutral-500 sm:flex-row sm:justify-between">
          <p>{t("footer.contact")}</p>
          <p>{t("footer.copyright")}</p>
        </div>
      </footer>
    </>
  );
}

import { SourceLink } from "@/components/source-link";
import { defaultLocale, isLocale, locales } from "@/i18n/locales";
import "../globals.css";

// Both languages are generated at build time. Any other value reaches the page, which answers 404.
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function RootLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  return (
    <html lang={isLocale(locale) ? locale : defaultLocale} className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        <SourceLink />
      </body>
    </html>
  );
}

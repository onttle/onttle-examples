import type { Metadata } from "next";
import Link from "next/link";
import { SearchBox } from "@/components/search-box";
import { SourceLink } from "@/components/source-link";
import "./globals.css";

// Includes the basePath (e.g. https://example.onttle.com/photo-portfolio)
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/photo-portfolio";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Seo-ha Yun Photography", template: "%s · Seo-ha Yun Photography" },
  description:
    "A photo portfolio example built on Onttle. The AI descriptions and keywords made at upload become alt text, tags and semantic search (Seo-ha Yun is a made-up photographer for this example).",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-neutral-200">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Seo-ha Yun Photography
            </Link>
            <SearchBox />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
        <footer className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16 text-sm text-neutral-500">
          Seo-ha Yun is a photographer made up for this example, and the place names point to no specific place. The photo
          descriptions and keywords were written by{" "}
          <a href="https://onttle.com" className="underline">
            Onttle
          </a>
          &apos;s AI at upload, used as they are or corrected by a person.
        </footer>
        <SourceLink />
      </body>
    </html>
  );
}

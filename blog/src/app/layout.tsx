import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import "./globals.css";

// Includes the basePath (e.g. https://example.onttle.com/blog)
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/blog";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Onttle Blog", template: "%s · Onttle Blog" },
  description: "A Next.js tech blog example that uses Onttle as a headless CMS",
  alternates: { types: { "application/rss+xml": "/feed.xml" } },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <nav className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
            <Link href="/" className="font-semibold">
              Onttle Blog
            </Link>
            <Form action="/search" className="flex-1 sm:max-w-xs">
              <input
                type="search"
                name="q"
                placeholder="Search"
                aria-label="Search posts"
                className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-1.5 text-sm dark:border-neutral-700"
              />
            </Form>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">{children}</main>
        <footer className="mx-auto w-full max-w-3xl px-4 py-8 text-sm text-neutral-500">
          Content is managed in <a href="https://onttle.com" className="underline">Onttle</a> ·{" "}
          <Link href="/feed.xml" prefetch={false} className="underline">
            RSS
          </Link>
        </footer>
      </body>
    </html>
  );
}

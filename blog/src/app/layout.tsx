import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Onttle Blog", template: "%s · Onttle Blog" },
  description: "Onttle을 헤드리스 CMS로 쓰는 Next.js 기술 블로그 예제",
  alternates: { types: { "application/rss+xml": "/feed.xml" } },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <nav className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
            <Link href="/" className="font-semibold">
              Onttle Blog
            </Link>
            <form action="/search" className="flex-1 sm:max-w-xs">
              <input
                type="search"
                name="q"
                placeholder="검색"
                aria-label="글 검색"
                className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-1.5 text-sm dark:border-neutral-700"
              />
            </form>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">{children}</main>
        <footer className="mx-auto w-full max-w-3xl px-4 py-8 text-sm text-neutral-500">
          콘텐츠는 <a href="https://onttle.com" className="underline">Onttle</a>에서 관리합니다 ·{" "}
          <a href="/feed.xml" className="underline">RSS</a>
        </footer>
      </body>
    </html>
  );
}

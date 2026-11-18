import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import "./globals.css";

// basePath 포함 (예: https://example.onttle.com/help-center)
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/help-center";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "노트포지 헬프센터", template: "%s · 노트포지 헬프센터" },
  description: "Onttle FAQ와 AI Agent로 만든 헬프센터 예제 (노트포지는 예제용 가상 서비스입니다)",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <div className="mx-auto max-w-3xl px-4 py-4">
            <Link href="/" className="font-semibold">
              노트포지 헬프센터
            </Link>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Form action="/search" className="flex-1">
                <input
                  type="search"
                  name="q"
                  placeholder="궁금한 내용을 검색하세요"
                  aria-label="FAQ 검색"
                  className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
                />
              </Form>
              <Link
                href="/ask"
                className="rounded-md bg-neutral-900 px-4 py-2 text-center text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
              >
                AI에게 물어보기
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">{children}</main>
        <footer className="mx-auto w-full max-w-3xl px-4 py-8 text-sm text-neutral-500">
          노트포지는 예제용 가상 서비스입니다. FAQ와 AI 답변은{" "}
          <a href="https://onttle.com" className="underline">
            Onttle
          </a>
          에서 관리합니다.
        </footer>
      </body>
    </html>
  );
}

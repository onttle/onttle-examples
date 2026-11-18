import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { UserNav } from "@/components/user-nav";
import "./globals.css";

// Includes the basePath (e.g. https://example.onttle.com/feedback-board)
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/feedback-board";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "MemoFarm Feedback", template: "%s · MemoFarm Feedback" },
  description:
    "A members-only feedback board built with Onttle members and table permission rules (MemoFarm is a fictional service for this example)",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-4">
            <Link href="/" className="font-semibold">
              MemoFarm Feedback
            </Link>
            <Suspense fallback={<span className="h-8" />}>
              <UserNav />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">{children}</main>
        <footer className="mx-auto w-full max-w-2xl px-4 py-8 text-sm text-neutral-500">
          MemoFarm is a fictional note app made up for this example. Anyone can read; members post; only the
          author can edit or delete. Sign-in and permissions run on{" "}
          <a href="https://onttle.com" className="underline">
            Onttle
          </a>
          .
        </footer>
      </body>
    </html>
  );
}

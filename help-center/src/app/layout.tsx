import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { SourceLink } from "@/components/source-link";
import "./globals.css";

// Includes the basePath (e.g. https://example.onttle.com/help-center)
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/help-center";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Noteforge Help Center", template: "%s · Noteforge Help Center" },
  description: "A help center example built with Onttle FAQs and an AI Agent (Noteforge is a fictional service for this example)",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <div className="mx-auto max-w-3xl px-4 py-4">
            <Link href="/" className="font-semibold">
              Noteforge Help Center
            </Link>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Form action="/search" className="flex-1">
                <input
                  type="search"
                  name="q"
                  placeholder="Search for help"
                  aria-label="Search FAQs"
                  className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
                />
              </Form>
              <Link
                href="/ask"
                className="rounded-md bg-neutral-900 px-4 py-2 text-center text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
              >
                Ask AI
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">{children}</main>
        <footer className="mx-auto w-full max-w-3xl px-4 pt-8 pb-16 text-sm text-neutral-500">
          Noteforge is a fictional service for this example. FAQs and AI answers are managed in{" "}
          <a href="https://onttle.com" className="underline">
            Onttle
          </a>
          .
        </footer>
        <SourceLink />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { SourceLink } from "@/components/source-link";
import "./globals.css";

// Includes the basePath (e.g. https://example.onttle.com/event-rsvp)
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/event-rsvp";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Makers' Night", template: "%s · Makers' Night" },
  description:
    "A login-free meetup RSVP page with a seat limit, built with two linked Onttle tables and a webhook (Makers' Night is a fictional meetup for this example)",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-4">
            <Link href="/" className="font-semibold">
              Makers&apos; Night
            </Link>
            <span className="text-sm text-neutral-500">A monthly meetup for indie developers</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">{children}</main>
        <footer className="mx-auto w-full max-w-2xl px-4 pt-8 pb-16 text-sm text-neutral-500">
          Makers&apos; Night is a fictional meetup made up for this example: the events, venues and attendees are not
          real, and demo entries are deleted periodically. Events, RSVPs and seat counts run on{" "}
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

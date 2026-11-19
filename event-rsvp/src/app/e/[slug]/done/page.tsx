import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatWhen } from "@/components/event-bits";
import { DONE_COOKIE } from "@/lib/base-path";
import { getEvent } from "@/lib/onttle";

export const metadata: Metadata = { title: "You're in", robots: { index: false } };

interface Done {
  slug: string;
  name: string;
  overLimit: boolean;
}

/** The cookie the RSVP action just set: the name typed into the form. Nothing is read back from Onttle. */
async function readDone(slug: string): Promise<Done | null> {
  try {
    const done = JSON.parse((await cookies()).get(DONE_COOKIE)?.value ?? "null") as Done | null;
    return done && done.slug === slug && typeof done.name === "string" ? done : null;
  } catch {
    return null;
  }
}

async function Confirmation({ params }: { params: PageProps<"/e/[slug]/done">["params"] }) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();
  const done = await readDone(slug);

  if (!done) {
    // Opened directly, or more than ten minutes later: nothing to confirm and nothing to look up.
    return (
      <>
        <h1 className="text-2xl font-bold">No RSVP to show</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          This page only shows right after you RSVP. Your details are not kept in the browser.
        </p>
        <Link href={`/e/${event.slug}`} className="mt-6 inline-block underline">
          Back to {event.title}
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold">{done.overLimit ? `Almost, ${done.name}` : `You're in, ${done.name}`}</h1>
      {done.overLimit ? (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Someone took the last seat at the same moment. Your RSVP was saved beyond the seat limit, so it is not
          a confirmed seat: the organizer will get in touch if one frees up.
        </p>
      ) : (
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">Your seat is saved. See you there.</p>
      )}
      <dl className="mt-6 rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
        <dt className="font-medium">{event.title}</dt>
        <dd className="mt-1 text-neutral-600 dark:text-neutral-400">
          {formatWhen(event.startsAt)}
          {event.venue && ` · ${event.venue}`}
        </dd>
      </dl>
      <p className="mt-4 text-xs text-neutral-500">
        This is a demo: no confirmation e-mail is sent, and entries are deleted periodically.
      </p>
      <Link href="/" className="mt-8 inline-block text-sm hover:underline">
        ← All events
      </Link>
    </>
  );
}

export default function DonePage(props: PageProps<"/e/[slug]/done">) {
  return (
    <Suspense fallback={<p className="text-neutral-500">Loading…</p>}>
      <Confirmation params={props.params} />
    </Suspense>
  );
}

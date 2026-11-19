import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FormatBadge, Seats, formatWhen } from "@/components/event-bits";
import { RsvpForm } from "@/components/rsvp-form";
import { countSeats, getEvent, listEvents, type MeetupEvent } from "@/lib/onttle";
import { hasPassed } from "@/lib/time";

export async function generateStaticParams() {
  const events = await listEvents();
  // Cache Components does not allow an empty array → one placeholder path (404) when there are no events
  return events.length > 0 ? events.map((e) => ({ slug: e.slug })) : [{ slug: "_" }];
}

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  return event ? { title: event.title, description: event.summary || undefined } : {};
}

/**
 * The only part of the page that changes often: seats left and, with them, whether the form shows.
 * It reads the "seats:{eventId}" cache, which the RSVP action updates and the webhook expires.
 * Whether the event is over comes from a 60-second cache, not from the time the page was built.
 */
async function SeatsAndForm({ event }: { event: MeetupEvent }) {
  if (await hasPassed(event.startsAt)) {
    return (
      <p className="mt-10 rounded-lg border border-neutral-200 p-4 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
        This event has already taken place.
      </p>
    );
  }

  const taken = await countSeats(event.id);
  const full = taken >= event.capacity;

  return (
    <section className="mt-10 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="font-semibold">Save a seat</h2>
      <div className="mt-3">
        <Seats taken={taken} capacity={event.capacity} />
      </div>
      <div className="mt-5">
        {!event.rsvpOpen ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">RSVPs for this event are closed.</p>
        ) : full ? (
          <div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Every seat is taken. RSVPs open again if a seat frees up.
            </p>
            <button
              type="button"
              disabled
              className="mt-4 cursor-not-allowed rounded-md bg-neutral-900 px-4 py-2 text-sm text-white opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
            >
              RSVP
            </button>
          </div>
        ) : (
          <RsvpForm slug={event.slug} />
        )}
      </div>
    </section>
  );
}

async function EventBody({ params }: { params: PageProps<"/e/[slug]">["params"] }) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  return (
    <article>
      <FormatBadge format={event.format} />
      <h1 className="mt-3 text-2xl font-bold leading-snug">{event.title}</h1>
      <dl className="mt-4 space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="w-14 shrink-0 text-neutral-500">When</dt>
          <dd>
            <time dateTime={event.startsAt}>{formatWhen(event.startsAt)}</time>
          </dd>
        </div>
        {event.venue && (
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-neutral-500">Where</dt>
            <dd>{event.venue}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="w-14 shrink-0 text-neutral-500">Seats</dt>
          <dd>{event.capacity}</dd>
        </div>
      </dl>
      {event.summary && <p className="mt-6 text-neutral-600 dark:text-neutral-400">{event.summary}</p>}
      {event.descriptionHtml && (
        <div
          className="mt-6 leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5"
          // HTML from the EDITOR column, written in the Onttle dashboard by the project's editors
          dangerouslySetInnerHTML={{ __html: event.descriptionHtml }}
        />
      )}
      <Suspense fallback={<p className="mt-10 text-neutral-500">Checking seats…</p>}>
        <SeatsAndForm event={event} />
      </Suspense>
    </article>
  );
}

export default function EventPage(props: PageProps<"/e/[slug]">) {
  return (
    <>
      <Suspense fallback={<p className="text-neutral-500">Loading…</p>}>
        <EventBody params={props.params} />
      </Suspense>
      <Link href="/" className="mt-12 inline-block text-sm hover:underline">
        ← All events
      </Link>
    </>
  );
}

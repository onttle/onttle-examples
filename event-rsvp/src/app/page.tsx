import Link from "next/link";
import { Suspense } from "react";
import { FormatBadge, Seats, formatWhen } from "@/components/event-bits";
import { countAllSeats, getSchedule, type MeetupEvent } from "@/lib/onttle";

function EventCard({ event, taken, past }: { event: MeetupEvent; taken: number; past?: boolean }) {
  return (
    <Link
      href={`/e/${event.slug}`}
      className={`block rounded-lg border border-neutral-200 p-4 transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600 ${past ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        <FormatBadge format={event.format} />
        <time dateTime={event.startsAt}>{formatWhen(event.startsAt)}</time>
        {event.venue && <span>· {event.venue}</span>}
      </div>
      <h3 className="mt-2 font-medium">{event.title}</h3>
      {event.summary && <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{event.summary}</p>}
      {!past && (
        <div className="mt-3">
          {event.rsvpOpen ? (
            <Seats taken={taken} capacity={event.capacity} />
          ) : (
            <p className="text-sm font-medium text-neutral-500">RSVPs closed</p>
          )}
        </div>
      )}
    </Link>
  );
}

/** Events come from the "events" cache, seat counts from the "seats" cache the webhook expires. */
async function Schedule() {
  const [{ upcoming, past }, seats] = await Promise.all([getSchedule(), countAllSeats()]);

  return (
    <>
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
            No upcoming events
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {upcoming.map((event) => (
              <li key={event.id}>
                <EventCard event={event} taken={seats[event.id] ?? 0} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Past</h2>
          <ul className="mt-4 space-y-3">
            {past.map((event) => (
              <li key={event.id}>
                <EventCard event={event} taken={0} past />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export default function Home() {
  return (
    <>
      <h1 className="text-2xl font-bold">Meet other makers, one evening a month</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Talks, workshops and demo calls for indie developers. Pick an event and save a seat: no account needed.
      </p>
      <Suspense fallback={<p className="mt-8 text-neutral-500">Loading…</p>}>
        <Schedule />
      </Suspense>
    </>
  );
}

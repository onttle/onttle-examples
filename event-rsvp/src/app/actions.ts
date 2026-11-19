"use server";

import { updateTag } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { BASE_PATH, DONE_COOKIE } from "@/lib/base-path";
import { OnttleError, SEATS_TAG, checkSeats, createRegistration, getEventFresh, seatsTag } from "@/lib/onttle";

export interface FormState {
  error?: string;
  /** The form is replaced by this message: nothing more to submit (full, closed, gone). */
  closed?: string;
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function messageFor(e: unknown): FormState {
  if (e instanceof OnttleError) {
    if (e.type === "invalidReferenceValue") return { closed: "This event no longer exists." };
    if (e.type === "insufficientCredit") return { error: "RSVPs are paused right now. Please try again later." };
    if (e.status === 400) return { error: "Please check the fields and try again." };
  }
  return { error: "Something went wrong. Please try again." };
}

async function finish(slug: string, name: string, overLimit: boolean): Promise<never> {
  (await cookies()).set(DONE_COOKIE, JSON.stringify({ slug, name, overLimit }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: BASE_PATH,
    maxAge: 600,
  });
  // With JavaScript the form is sent by fetch (it carries a Next-Action header) and Next adds the basePath
  // to the redirect. Without JavaScript the browser posts the form itself, and Next 16.4 writes the
  // Location header as given, so the basePath has to be added here or the visitor lands on a 404.
  const viaFetch = (await headers()).has("next-action");
  redirect(`${viaFetch ? "" : BASE_PATH}/e/${slug}/done`);
}

/** Bound to the event's slug by the page. Everything is checked again here, as it is right now. */
export async function rsvpAction(slug: string, _: FormState, form: FormData): Promise<FormState> {
  const name = text(form, "name");
  const email = text(form, "email");
  const note = text(form, "note");

  // Honeypot: a field people cannot see. A bot that fills it gets the same confirmation and no row.
  if (text(form, "website")) await finish(slug, name.slice(0, 40) || "there", false);

  if (!name || name.length > 40) return { error: "Enter your name (up to 40 characters)." };
  if (!EMAIL.test(email) || email.length > 254) return { error: "Enter a valid e-mail address." };
  if (note.length > 300) return { error: "Keep the note under 300 characters." };

  let overLimit = false;
  try {
    const event = await getEventFresh(slug);
    if (!event) return { closed: "This event no longer exists." };
    if (new Date(event.startsAt).getTime() < Date.now()) return { closed: "This event has already taken place." };
    if (!event.rsvpOpen) return { closed: "RSVPs for this event are closed." };

    const seats = await checkSeats(event.id, email);
    // Said in the same words whoever asks, and only to someone who typed the address.
    if (seats.alreadyRegistered) return { error: "This e-mail is already registered for this event." };
    if (seats.taken >= event.capacity) {
      updateTag(SEATS_TAG);
      return { closed: "This event is full." };
    }

    const { position } = await createRegistration({ event: event.id, name, email, note });
    overLimit = position > event.capacity;

    updateTag(SEATS_TAG);
    updateTag(seatsTag(event.id));
  } catch (e) {
    return messageFor(e);
  }

  return finish(slug, name, overLimit);
}

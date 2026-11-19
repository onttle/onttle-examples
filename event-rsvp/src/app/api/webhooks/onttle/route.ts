import { revalidateTag } from "next/cache";
import { SEATS_TAG } from "@/lib/onttle";
import { verifyOnttleSignature, type WebhookPayload } from "@/lib/webhook";

/**
 * The only path Onttle calls on this app. Webhook `rsvp-seats`: registrations CREATED · DELETED.
 * Signature first, on the raw body. Then the seat caches are expired: every seat cache carries the
 * "seats" tag, so one call covers the list and every event page (a DELETED event has no data to say
 * which event it was). Nothing from the payload is logged: it holds a name and an e-mail address.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signingKey = process.env.ONTTLE_WEBHOOK_SIGNING_KEY ?? "";

  if (!verifyOnttleSignature(rawBody, request.headers.get("x-onttle-signature"), signingKey)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  // Not a Server Action, so updateTag is not available: expire now instead of serving stale counts.
  revalidateTag(SEATS_TAG, { expire: 0 });

  return Response.json({ ok: true, event: payload.event });
}

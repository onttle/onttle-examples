# Meetup RSVP Built on Onttle (event-rsvp)

A Next.js site for a meetup: **event list, event page, and an RSVP form with a seat limit, no login**. Two linked Onttle tables hold the events and the RSVPs, and an Onttle webhook tells the site when the seat count changed. There is no database and no notification server in this app.

| Who | Can |
| --- | --- |
| Visitor | Read events, RSVP with a name, an e-mail address and an optional note |
| Visitor | Never read anyone's RSVP: the `registrations` table answers only to the secret key, and the secret key stays on the server |
| Organizer (dashboard) | Add events, set the seat limit, close RSVPs with `rsvp_open` |

"Makers' Night" is a fictional meetup made up for this example. The events, venues and attendees are made up; no real company or person is used.

- Demo: https://example.onttle.com/event-rsvp
- Build record: [docs/BUILD_LOG.md](docs/BUILD_LOG.md)

## Screens

Every path is under the `basePath` `/event-rsvp` (local: `http://localhost:3000/event-rsvp`).

| Path | What it shows | Rendering |
| --- | --- | --- |
| `/` | Upcoming events soonest first with seats left or "Full"; past events below, dimmed | Events from a 60-second cache tagged `events`, seat counts from a cache tagged `seats` |
| `/e/[slug]` | Event details and the RSVP form | Prerendered for every event at build time; seats and form stream inside `<Suspense>` from the cache tagged `seats:{eventId}` |
| `/e/[slug]/done` | "You're in, {name}" right after an RSVP | Request time: reads a 10-minute httpOnly cookie holding the name just typed. The e-mail is not shown again |
| `/api/webhooks/onttle` | Webhook receiver (POST) | Verifies the signature, then expires the `seats` caches |

## Onttle features used

| Feature | Where | Used for |
| --- | --- | --- |
| REFERENCE column | `registrations.event` → `events` | Each RSVP belongs to one event. The request sends the event's content id |
| Webhook | `rsvp-seats`: `registrations` CREATED · DELETED → `POST /api/webhooks/onttle` | Seat counts change on every open page without waiting for the cache to expire |
| Permission rules | `registrations`: read / create / update / delete all **Secret key only** | Names and e-mail addresses cannot be read with a publishable key |
| Secret key on the server | `sk-proj_…` in `X-Onttle-Key`, in [`src/lib/onttle.ts`](src/lib/onttle.ts) only | Every call. The browser never calls Onttle |
| Table API | `GET /tables/events`, `GET /tables/events/{slug}`, `GET /tables/registrations`, `POST /tables/registrations` | List, detail, seat count, RSVP |
| CATEGORY, EDITOR, TIMESTAMP columns | `events.format`, `events.description`, `events.starts_at` | Format badge, event details (HTML), date and time |

### How an RSVP is checked

The form posts to a Server Action ([`src/app/actions.ts`](src/app/actions.ts)). It does not trust the page:

1. A hidden honeypot field. A bot that fills it gets the same confirmation page and no row is written.
2. Name, e-mail and note are validated.
3. The event is read again without the cache: it must exist, be in the future and have `rsvp_open` on.
4. The registrations are read again without the cache: the e-mail must not be registered for this event already, and seats taken must be below the capacity.
5. `POST /tables/registrations` with `is_publish: true`.
6. The registrations are counted once more. Onttle has no transaction or conditional write, so two people can both pass step 4 for the last seat. Whoever lands beyond the limit is told so on the confirmation page ("saved beyond the seat limit, not a confirmed seat").
7. `updateTag` on the seat caches, then a redirect to `/e/[slug]/done`.

### Why a webhook when the action already updates the cache

The action only knows about RSVPs made through this site. A row added or removed by another API client (an organizer's script, the Onttle MCP server) changes the seat count too, and the webhook is how the site hears about it.

Two limits from the Onttle docs shape the design:

- **Each event is sent once, with no retry.** A missed delivery would leave a wrong number forever, so the seat caches also revalidate every 60 seconds.
- **Edits made in the dashboard send no event.** That is why `events` is not subscribed: organizers edit events in the dashboard, and the 60-second cache picks the change up.

The handler verifies `X-Onttle-Signature` on the raw body ([`src/lib/webhook.ts`](src/lib/webhook.ts): HMAC-SHA256 of `{t}.{body}`, 5-minute tolerance, `timingSafeEqual`) and answers 401 when it does not match. `pnpm test` signs a made-up payload with a made-up key and checks eight cases, including a body that was parsed and serialized again.

### Keeping personal data in

- Nothing exported from `src/lib/onttle.ts` returns a name or an e-mail address. `countSeats` and `countAllSeats` return numbers; `checkSeats` returns a count and one boolean.
- Registration rows are never passed to a component, so they cannot end up in the HTML or the RSC payload.
- The webhook payload carries the new row. The handler logs nothing from it.
- Errors log the status, method and path only.

## Preparing the Onttle project

1. Create a project (005-event-rsvp uses one language, `en`).
2. Table `events` (slug `events`, slug support on):
   | Column | Type | Options |
   | --- | --- | --- |
   | `title` | TEXT | required, max 100 |
   | `summary` | TEXT | textarea, max 200 |
   | `description` | EDITOR | — |
   | `starts_at` | TIMESTAMP | required. Stored without a zone; the app reads it as KST |
   | `venue` | TEXT | max 100 |
   | `format` | CATEGORY | required, single — category "Event format": Talk Night, Workshop, Online |
   | `capacity` | NUMBER | required, min 1 |
   | `rsvp_open` | BOOLEAN | default true |
3. Table `registrations` (slug `registrations`, slug support off):
   | Column | Type | Options |
   | --- | --- | --- |
   | `event` | REFERENCE → `events` | required |
   | `name` | TEXT | required, max 40 |
   | `email` | EMAIL | required |
   | `note` | TEXT | textarea, max 300 |
4. Permission rules. `events`: read **public**, the rest Secret key only (the default). `registrations`: **read Secret key only** as well. The default read rule is public, which would let anyone with a publishable key read every e-mail address.
5. API endpoints. `events`: list and item on, the rest off. `registrations`: list and create on, the rest off.
6. API → issue a **secret key** (dashboard only).
7. After the first deployment: Webhooks → New Webhook, name `rsvp-seats`, URL `https://<your site>/event-rsvp/api/webhooks/onttle`, table `registrations`, events CREATED and DELETED. Open it again and copy the **Signing key** into `ONTTLE_WEBHOOK_SIGNING_KEY`.
8. Optional: sample rows (the demo has 4 events and 4 RSVPs from "Sample attendee A–D" at `example.com` addresses).

## Running it

```bash
pnpm install
cp .env.example .env.local   # fill in the values
pnpm dev                     # http://localhost:3000/event-rsvp
```

| Variable | Value |
| --- | --- |
| `ONTTLE_API_URL` | `https://api.onttle.com/v1` |
| `ONTTLE_PROJECT_ID` | Project ID |
| `ONTTLE_API_KEY` | Secret key (`sk-proj_…`). Server only, never `NEXT_PUBLIC_` |
| `ONTTLE_EVENTS_TABLE` | `events` (slug or table id) |
| `ONTTLE_REGISTRATIONS_TABLE` | `registrations` |
| `ONTTLE_WEBHOOK_SIGNING_KEY` | Signing key of the webhook `rsvp-seats` |
| `NEXT_PUBLIC_SITE_URL` | `https://example.onttle.com/event-rsvp` (local: `http://localhost:3000/event-rsvp`) |

Onttle cannot reach `localhost`, so the webhook only arrives on a deployed site. Locally, the signature check is covered by the test, and the seat counts still update through the Server Action and the 60-second revalidation.

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

## Clearing demo entries

The demo collects real e-mail addresses from whoever tries it, so they are deleted periodically: in the dashboard, open `registrations`, select every row except the four samples and delete. The delete endpoint of the public API is off for this table on purpose.

## Deployment

Vercel project `onttle-examples-event-rsvp`, Root Directory `event-rsvp`, served at `https://example.onttle.com/event-rsvp` through [_gateway](../_gateway). Set the seven variables above in Vercel (the secret key and the signing key as Sensitive).

# BUILD_LOG — event-rsvp

A record for writing the post. Numbers and scenes are only what actually happened. `TODO` marks what is not filled in yet.

## Summary

| Item | Detail |
| --- | --- |
| Started | 2026-11-19 (KST) |
| Finished | TODO (done locally: real REST shapes, lint, typecheck, test, build, read pages. Left: a real RSVP write, deployment, webhook, limit tests) |
| Built with | Claude Code (desktop app) + the Onttle MCP server (account connection) |
| Onttle project | Onttle Examples workspace · `005-event-rsvp` (one language, en) |
| Next.js | 16.4.6 (same version and settings as feedback-board: Cache Components, Partial Prefetching) |
| Plan | [Onttle example plan] A meetup RSVP page built on Onttle (event-rsvp, 2026-11-19) |
| Instructions from the person | The plan link + "005-event-rsvp is already added in Onttle" → asked twice (tables, secret key) → "create with MCP" for both |

## 1. Onttle project

State seen through MCP at the start: the project existed, with **no tables, no categories, no API keys, no webhooks**, and the member feature off. This shell had no `ONTTLE_*` variables and there was no `event-rsvp/.env.local` (names checked only). The plan's step 1 says to stop when a variable is missing, so Claude asked instead of guessing:

| Question | Answer |
| --- | --- |
| Tables: create with MCP as in the plan, or run the dashboard AI design first? | Create with MCP |
| Secret key: issue with MCP, or paste it into `.env.local` yourself? | Issue with MCP |

### Expected vs. AI design

**Not compared.** The tables were created through MCP from the plan's expected schema, so the dashboard AI design never ran and `01-ai-design.png` does not exist. If the post needs the comparison, run the AI design on a scratch project with the plan's service description.

### What was created (MCP, preview → confirm each time)

| What | Result |
| --- | --- |
| Table `events` + category "Event format" (Talk Night, Workshop, Online) | Created as planned, except `starts_at` (next row) |
| `starts_at` type | The plan asked whether DATE holds a time. The Column Types doc shows DATE as `"2026-08-30"` only, so **TIMESTAMP** was used (`"YYYY-MM-DD hh:mm:ss"`, no zone) |
| `email` type | EMAIL exists and was used |
| Table `registrations` | Created in two steps (see below). Column order is name, email, note, event |
| Permission rules | `events`: read public, rest none. `registrations`: all four none (the preview said "Only a secret key can read rows.") |
| API endpoints | `events`: list, item on. `registrations`: list, create on. Everything else off |
| Samples | 4 events (3 upcoming: capacity 30 / 3 / 2, 1 past with `rsvp_open` false) and 4 registrations (2 on the workshop → 1 seat left, 2 on the online event → full), all PUBLISHED |

**`onttle_create_table` could not create the REFERENCE column.** With `reference_table_id` set to the events table's id (`QlAY…`, the only table id MCP returns) the preview passed and the confirmed call failed with `invalidReferenceTableId`. The slug `events` failed the same way. What worked: create `registrations` without the column, then `onttle_update_table` → `add_columns` with the same `reference_table_id`. Same value, different tool. 2 failed calls.

**MCP cannot issue a secret key.** `onttle_create_api_key` says "Secret keys are issued in the dashboard only" and creates publishable keys. Claude had offered "issue with MCP" without reading the tool's schema first; the person picked it, and it turned out not to exist. The key has to come from the dashboard.

## 2. Docs and spec vs. real responses

Checked with the secret key against the REST API (`curl`, read calls plus one empty POST that wrote nothing). **The code needed no change**: the REST shapes are the ones the project's TypeScript describes, and they differ from what the MCP tools show.

| Item | Docs / spec | MCP view | REST (secret key) |
| --- | --- | --- | --- |
| Row envelope | — | Columns at the top level | `{ id, created_at, updated_at, published_at, data: { …columns }, slug }` |
| REFERENCE in a response | Docs: `Record<string, unknown>`. Project TypeScript: `Reference { tableId, uuid }` | The id as a plain string | `{ "tableId": "events", "uuid": "<content id>" }`. `tableId` holds the table **slug**, not the id |
| REFERENCE in a request | The content id string | Accepted (samples) | Accepted: `"event": "<content id>"` |
| CATEGORY in a response | Project TypeScript: `Category { id, name }` | One-item array `[{ id, name }]` | One object `{ id, name }` |
| TIMESTAMP in a response | `string` | `"2026-12-22 20:00:00"` | The same: as written, no zone. `created_at` is ISO with `Z` |
| EDITOR in a response | `{ json, html, markdown, plain }` | Plain text only | All four keys. `html` wraps list items in `<li><p>…</p></li>` |
| `GET /tables/events/{slug}` with an unknown slug | — | — | 404 `{ "type": "notFound" }` (feedback-board saw 200 with another row; not here) |
| `GET /tables/events/{content id}` | — | — | 200: the path takes the slug **or** the id. The app compares `row.slug` with the URL, so `/e/<uuid>` is a 404 and each event has one URL |
| `size` on the list | 1–100, default 50 | — | Honored (`size=2` → 2 rows, `totalPages` 2). `size=500` → 400 `invalidRequest` "size must be an integer from 1 to 100." |
| `filter` on a REFERENCE column | Column Types: REFERENCE is not searchable or sortable | — | `filter[event]=<id>` and `event=<id>` are ignored without an error: all 4 rows come back. Counting stays in the app |
| Error body | `type` field (Error Codes doc) | — | `{ type, title, message }`. `message` is a string, or an array for validation: `["name: required", "email: required", "event: required"]` |
| `registrations` without a key | — | — | 401 `unauthorized` |
| An endpoint that is off (`GET /tables/registrations/{id}`) | — | — | 403 `apiNotEnabled` |

Seen in the app: an unknown slug shows the not-found page with HTTP **200**, in `next dev` and on the deployed site, because `notFound()` runs inside `<Suspense>` after the shell has been sent. Left as it is (same as feedback-board).

## 3. Steps and prompts

The person gave the plan link once; Claude worked through the plan's steps without separate prompts.

| Step | What happened |
| --- | --- |
| 1. Environment and spec | Env missing and tables missing → two questions. Tables, rules, endpoints and samples created through MCP. Spec summary and API reference read through MCP (12 operations; the two tables show only the endpoints left on) |
| 2. App skeleton and read pages | Config copied from feedback-board (no shared code). `src/lib/onttle.ts`: `listEvents`, `getSchedule`, `getEvent`, `countAllSeats`, `countSeats`. Pages `/` and `/e/[slug]` |
| 3. RSVP and seat limit | Server Action `rsvpAction`: honeypot → validation → fresh event → fresh count and duplicate e-mail → POST → count again → `updateTag` → `/e/[slug]/done` |
| 4. Webhook | `src/lib/webhook.ts`, `src/app/api/webhooks/onttle/route.ts`, `pnpm test` (8 cases, all pass) |
| Webhook registered | `onttle_create_webhook` (preview → confirm, 1 call each): `rsvp-seats`, `registrations` CREATED · DELETED, URL through the gateway. Neither the create answer nor `onttle_list_webhooks` returns the signing key, so it has to be copied from the dashboard. Until it is in Vercel every delivery is answered 401 |
| Signing key in place | The person copied the key from the dashboard into `.env.local` and Vercel (two tries: the first pipe ran while `.env.local` was still empty and the CLI stopped at `? Value?`; also asked Claude to "generate" the key, which cannot be done — it is Onttle's). The variable was re-added while a deploy was building, so that deploy still answered 401 to a correctly signed request; one more deploy fixed it. Self-signed checks through the gateway with the local key: valid 200, changed body 401, 10-minute-old timestamp 401. This proves Vercel and `.env.local` hold the same key, not yet that Onttle signs with it |
| 5. Limits (the person said go: 5 test writes) | See the numbers in section 5. In short: REST writes fire the webhook and the signature passes; an MCP write fires nothing and the 60-second revalidation picks it up; three RSVPs sent in the same second for one seat were all saved |
| Bug found by the race test | The race script posted the form the way a browser without JavaScript does. All three rows were saved, but the redirect went to `/e/…/done` **without the basePath** → 404 on the gateway. Next 16.4 adds the basePath to a Server Action redirect only for fetch requests; for a plain form POST it writes the `Location` header as given (`action-handler.js`: "For an MPA action, the redirect doesn't need a body, just a Location header"). Fix in `src/app/actions.ts`: add `BASE_PATH` when the request has no `Next-Action` header. Checked both ways with a honeypot post (no row): curl → `location: /event-rsvp/e/…/done`, browser → lands on `/event-rsvp/e/…/done` |
| GitHub link (asked mid-way) | "On each example page, a GitHub link with an icon at the bottom right of the screen, to that example's folder." `src/components/source-link.tsx` in all five examples (not shared), fixed bottom-right, footers padded so it does not cover the last line. lint, typecheck and build pass in all five. On "yes, redeploy" the other four were deployed with the CLI from the local files (their projects are git-connected to main, so a deploy from main before this branch is merged removes the link again); the link is in the HTML of all five live sites |
| Local check with the secret key | `pnpm build` passes (4 event pages prerendered, `/` static with 1m revalidate). Browser: 3 upcoming + 1 past, Workshop "1 seat left", Online "Full" with a disabled button, past event without a form, unknown slug and `/e/<uuid>` → not found, duplicate e-mail refused with no row written (total stayed 4). Build output and repo files scanned for the key, the project ID and the sample e-mails: 0 hits |
| Local RSVP (the person said go) | One RSVP through the form on December Talk Night → redirect to `/done`, list went from "30 seats left" to "29 seats left" on the next load. REFERENCE in a request: the content id string is accepted over REST too |
| 6. Deployment and records | Gateway rewrites, gateway index and root README edited locally. Vercel project `onttle-examples-event-rsvp` created with the CLI (`vercel project add`, then `framework: nextjs` and `rootDirectory: event-rsvp` through the API, so the feedback-board "no public directory" failure is avoided up front). 5 non-secret variables added to Production and Preview. The person added `ONTTLE_API_KEY` (Sensitive) with a one-line pipe from `.env.local`. Deployed with `vercel deploy --prod` from the repository root with `VERCEL_PROJECT_ID` set (the project has a Root Directory, so the subfolder cannot be deployed directly; the root `.vercel` link was not touched): **first deploy succeeded**. On `onttle-examples-event-rsvp.vercel.app/event-rsvp`: list shows 29 / 1 / Full, the four event pages 200, webhook route GET 405 and POST without or with a bad signature 401, and the key, project ID, sample names and e-mails appear 0 times in the HTML. Git is not connected. Gateway deployed the same way as for feedback-board (a temporary folder holding only `_gateway/`, `VERCEL_PROJECT_ID` set) on the person's "yes, deploy": `example.onttle.com/event-rsvp` 200 with the same seat counts, the other four examples still answer, and **a POST to `/event-rsvp/api/webhooks/onttle` through the gateway rewrite reaches the handler with no redirect** (401 without a signature, GET 405). The live gateway now runs uncommitted changes: a git deploy from main would undo them until this branch is merged |

### Where the code leaves the plan

| Plan | Built | Why |
| --- | --- | --- |
| zod for form validation | Plain checks in the action | Three fields; no new dependency |
| `listFormats` (`GET /categories`) | Not written | No screen uses it: the format name comes with each event row |
| `/e/[slug]/done` static, shows the name | Request time, reads a 10-minute httpOnly cookie | A static page cannot know the name, and a `?name=` query would put personal data in the URL |
| Webhook revalidates `seats` and `seats:{eventId}` | Revalidates `seats` only | Every seat cache carries both tags, and a DELETED payload has no `data` to say which event it was |
| `starts_at` DATE | TIMESTAMP, read as KST when it has no zone | DATE has no time |

## 4. What the agent got wrong

| # | What | How it was caught |
| --- | --- | --- |
| 1 | Offered to issue the secret key with MCP; MCP only issues publishable keys | The tool description, read after the person had already chosen it |
| 2 | Exported a constant (`DONE_COOKIE`) from the `"use server"` file | Noticed before the first build; moved to `src/lib/base-path.ts` |
| 3 | First draft showed the RSVP form on events that are over (only the action refused) | Review of the page before running it; added a 60-second cached "has passed" check |
| 4 | Without JavaScript the RSVP was saved but the visitor landed on a 404 (redirect without the basePath) | The race test, which posts the form with curl. Every browser check had JavaScript on and passed |

REFERENCE creation failing twice (section 1) is the tool's behavior, not a guess gone wrong, but it cost two calls.

## 5. Numbers for the post

| Item | Value |
| --- | --- |
| Tables / columns | 2 tables, 12 columns, 1 category with 3 values |
| MCP writes (confirmed) | 8: `create_table` ×2, `update_table` ×1, `create_contents` ×2, `set_api_settings` ×1, `create_webhook` ×1, plus 2 `create_table` calls that failed |
| Signature test | 8 cases, 8 pass |
| Webhook: time from the row's `created_at` to the delivery in the webhook log | 4 deliveries: 0.65 s, 0.63 s, 0.49 s, 0.40 s. All answered 200 |
| Webhook: signature failures | 0 of 4 real deliveries. (Before the key was in Vercel nothing was delivered, so no real 401 was recorded) |
| Dashboard edit sends an event? | TODO (docs say no) |
| MCP write sends an event? | **No.** `onttle_create_contents` (PUBLISHED) at 11:25:21Z; the webhook log stayed at 4. The docs list dashboard edits as not firing and do not mention MCP. The list still said 28 seats left 75 s later and 27 at 95 s: the 60-second fallback did its job |
| 3 RSVPs at once for 1 seat: how many got in | **3 of 3 saved** (rows created within 0.25 s). The first by `created_at` saw "You're in"; the other two saw "Almost … saved beyond the seat limit". The workshop now holds 5 rows for 3 seats and shows Full, 3 / 3 |
| MCP delete sends an event? | **No.** The six test rows ("Test visitor 1–6") were deleted with `onttle_delete_contents` on the person's "yes, delete"; the webhook log stayed at 4, so **DELETED was never delivered in this build** and is only covered by the signature test. The site caught up through the 60-second revalidation: the first request after the window still got the old number, the next one the new one (list 30 / 1 seat left / Full, workshop page "1 seat left") |
| Webhook Requests (Workspace → Usage), write calls | TODO |
| Vercel deploys | event-rsvp 4 (0 failed; 2 for the signing key, 1 for the redirect fix and the GitHub link), gateway 1, the other four examples 1 each |
| Time spent | TODO |

## 6. Left to do

- Gateway change committed to main (live already, from the local files); connect git
- Dashboard edit → no webhook (the person has to edit a row); screenshots 02–06 in `docs/assets/`; `docs/POST.md`

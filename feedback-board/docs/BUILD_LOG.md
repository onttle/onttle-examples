# BUILD_LOG — feedback-board

A record for writing the post. Numbers and scenes are only what actually happened. `TODO` marks what is not filled in yet.

## Summary

| Item | Detail |
| --- | --- |
| Started | 2026-11-18 (KST) |
| Finished | TODO (a real sign-up → post → 403 on someone else's post, and the screenshots, are left) |
| Built with | Claude Code (desktop app) + the Onttle MCP server (account connection) + Vercel CLI |
| Onttle project | Onttle Examples workspace · `004-feedback-board` (one language, en) |
| Next.js | 16.4.6 (same version and settings as help-center and i18n-landing: Cache Components, Partial Prefetching) |
| Plan | [Onttle example plan] A members-only feedback board built on Onttle (feedback-board, 2026-11-18) |
| Instructions from the person | The plan link + "use a service name other than Noteforge" → turned down the first suggestion (Jotfield) and chose **MemoFarm** → "deploy to Vercel directly" → "deploy now" (gateway) → "change the markup, md and Onttle data to English" |

## 1. Onttle project

As the plan's "Onttle setup record" said, the table, the permission rules and the member feature were already in place. State seen through MCP at the start:

| Item | Plan | Actual |
| --- | --- | --- |
| Table | `feedback` (title, body, kind, progress, author_name) | Same. Slug `feedback` |
| Permission rules | read public · create member · update owner · delete owner | Same |
| Member feature | On, Bearer, access 15 minutes · refresh 30 days | Same. 2 allowed origins (deployed site, localhost), verify redirect `/feedback-board/verify` |
| Monthly sign-up limit | To be set by the person | **Not set (null)** — TODO: set it in the dashboard, the demo is public |
| Samples | 12 rows, PUBLISHED | Same. No owner member |
| API keys | A publishable key is needed | **0** → issued one publishable key with MCP `onttle_create_api_key` (no allowed hosts, no expiry). No secret key |
| OpenAPI spec | Fetch again after the member feature is on | Read with MCP `onttle_get_openapi_spec`. It includes the Member API and `x-onttle-rule` |

- MCP returns the publishable key once. It was written straight into `feedback-board/.env.local` (git-ignored) and never into chat, docs or commits.
- This shell had no `ONTTLE_*` variables at all (names checked only). The project ID came from MCP.

### Service name (the plan's Korean name → MemoFarm)

- The plan's fictional service had a Korean name ("memo field"). The instruction was "not Noteforge" (the help-center example's name). Claude suggested "Jotfield"; the person chose **MemoFarm**.
- Two places in Onttle carried the name and were changed through MCP (preview → confirm): one sample's `author_name` and the table description.

### Everything to English

The first version kept the plan's Korean data (sample posts, category names) with an English UI, like help-center. Later the person asked for English everywhere. Changed through MCP in three calls (preview → confirm):

| What | To |
| --- | --- |
| Category for `kind` (3 values) | Feedback type: Suggestion · Bug Report · Question (values renamed in the dashboard) |
| Category for `progress` (3 values) | Progress: Pending · Planned · Complete (values renamed in the dashboard) |
| Samples | 12 rows: title, body, author_name in English (Sample user A–D, MemoFarm team) |
| Table description | English |

- **The 6 category value names did not change through MCP.** `onttle_update_categories` with `rename_values` previewed the six renames and answered `applied: true` twice, but `onttle_list_categories` and the REST API still returned the Korean value names; only the two category names changed. The person renamed the values in the dashboard, with names of their own: **Suggestion · Bug Report · Question / Pending · Planned · Complete** (not the ones Claude had proposed). The badge colors in the app key on these names, so the code was changed to match and redeployed. Ids did not change, so rows and `?kind=<id>` links kept working.
- The app keyed two things on the Korean names: the badge colors and the lookup of the type category (`KIND_CATEGORY`). Both were changed and the app redeployed. Lesson for the post: key on ids, or expect a rename in the dashboard to need a deploy.
- Editing the samples set their `updated_at`, so all 12 now show "edited" on the detail page.
- This file was Korean (the other examples' build logs are) and was rewritten in English.

## 2. Docs and spec vs. real responses (publishable key, 2026-11-18)

| Call | Docs / spec | Real response |
| --- | --- | --- |
| Content path | Endpoints doc `/tables/{table}` / request example `/tables/posts/contents` | The spec says `/tables/feedback`; the app follows the spec. `/tables/feedback/contents` also answers 200, but only because **`contents` is taken as an id** (next row) |
| Item with an unknown id | No 404 in the spec (200 · 400 · 500) | **200 with another row** (the oldest sample). Same for an all-zero UUID, `not-an-id` and a random UUID → `getFeedback()` checks that the returned `id` equals the requested one, otherwise 404 |
| List `size` | Spec: default 20, max 1000 | **Ignored.** `size=2` returns 12 rows and `pagination.size` is always 50 (same as help-center and i18n-landing) |
| List `filter`, `fields` | In the spec | **Ignored.** `filter=kind:<id>` and `fields=title` return the same response → the app filters and pages |
| CATEGORY columns | Spec `TableItem_feedback`: uuid string / MCP TypeScript: `Category` (`{ id, name }`) / plan: an array in the MCP view | REST returns **one `{ id, name }` object.** The array appears only in the MCP view. `normalize()` accepts both |
| Row shape | Spec: columns at the top level | **`{ id, created_at, updated_at, published_at, data: { … } }`** (as in the MCP TypeScript). Dates are ISO strings (the `{}` seen in i18n-landing did not appear here) |
| Owner field | Plan: to be checked | **Not in the response.** So Edit and Delete cannot be hidden on other people's posts → shown to every signed-in member, and the 403 is shown as a message |
| Auth header | Spec: `X-Onttle-Key` (member token in `Authorization: Bearer`) | Works. `Authorization: Bearer <publishable key>` also works for reads |
| `POST /tables/feedback` without a member token | Spec: 401 | 401 `{ code: "AUTH_TOKEN_INVALID" }` |
| `GET /categories` | Spec: object | **Array** `[{ id, name, description, categories_values: [{ id, name }] }]`. Readable with a publishable key (an open question in the plan) |
| Publishable key sent from a server (no Origin header) | Plan: how do the allowed host / origin checks apply? | **Passes.** With a key that has no allowed hosts, curl and Server Actions both work, `/auth/login` included. The BFF design holds |
| Login with a wrong password | 401 `AUTH_INVALID_CREDENTIALS` | Same (seen in the browser as "The e-mail or password is incorrect.") |

- `is_publish` is not in the spec's request body, only in the MCP TypeScript `FeedbackRequest`. The app sends it, as the plan says. Whether it is really needed is TODO (check when posting as a real member).
- Sign-up, verification, create, update and delete have not been called for real yet. A sign-up costs credits and needs a real mailbox, so the person checks them with two test addresses, as the plan says (TODO).

## 3. Step by step

The prompts in section 5 of the plan were not entered one by one: one instruction with the plan link carried steps 1 to 5. The person was asked one question (three Onttle changes: the key and the name in two places), and the answer changed the name to MemoFarm.

### Step 1 — Environment and spec

- The plan is a Claude Docs document, so it was read through the Docs connector, not as an artifact page.
- `onttle_get_schema`, `onttle_get_member_settings`, `onttle_get_openapi_spec` (full), `onttle_list_api_keys` (0), `onttle_search_contents` (12) → section 1.
- After the key was issued, the real responses were checked with curl → section 2. The key was read from `.env.local` and never printed.

### Step 2 — App skeleton and read pages

- There is no `pnpm new`, so the config files of i18n-landing (`tsconfig.json`, eslint, `.gitignore`, `pnpm-workspace.yaml`, `AGENTS.md`, `globals.css`) were copied and next-intl was removed from `package.json`.
- `src/lib/onttle.ts` (`server-only`): the reads `listFeedback`, `getFeedback` and `listKinds` use `"use cache"` + `cacheTag("feedback")` + 60 seconds. Calls that carry a member token are never cached.
- `/`: the list data is cached; `?kind` and `?page` are request-time, so the list streams inside `<Suspense>`. 10 per page.
- `/f/[id]`: `generateStaticParams` builds the 12 rows. Only the Edit / Delete area reads cookies, inside `<Suspense>`.
- Different from the plan: it said "ISR (revalidate 60) + tags". With Next.js 16 Cache Components the same effect is `cacheLife({ revalidate: 60 })` + `cacheTag`. After a write the app calls **`updateTag`** instead of `revalidateTag` (Server Actions only; the next request waits for fresh data, so your own post shows at once).

### Step 3 — Session (BFF), sign-up, verification, login

- `src/lib/session.ts`: three httpOnly cookies — `fb_at` (access, `expiresIn - 30` seconds), `fb_rt` (refresh, 30 days), `fb_name` (display name for the header, so the header does not call `GET /me` on every request). `secure` in production only, `sameSite: lax`, `path: /feedback-board`.
- The plan's `src/middleware.ts` is **`src/proxy.ts`** in Next.js 16 (renamed; same as i18n-landing).
- Proxy: no access cookie but a refresh cookie → refresh, write the new cookies on the response, and **also replace the request cookies so the page rendering now reads the new token**.
- One risk the plan did not list: the spec says that sending a refresh token that was already used signs that login out everywhere. On a page full of links, prefetch requests could all try to refresh with the same token once the access token expires. So (1) prefetch requests never refresh and (2) concurrent refreshes with the same token share one call (kept for 10 seconds). With several serverless instances, (2) only helps within one instance — TODO: leave the deployed site open for more than 15 minutes and check.
- Server Actions use `withMember()`: no access token, or a 401 from Onttle → refresh once and retry once; on failure clear the cookies and go to `/login?next=…`.
- `/new` and `/f/[id]/edit`: with no session at all the proxy redirects to `/login?next=…`.
- Sign-up: the display name goes to `profile.name`, the agreement to `consents` (terms and privacy, version `2026-11-18`). The form has a checkbox: "demo, e-mail and name are stored, accounts are deleted periodically". No separate terms page (an open question in the plan — TODO: the person decides).
- Messages per error code follow section 4 of the plan (`AUTH_FORBIDDEN`, `AUTH_EMAIL_NOT_VERIFIED` → resend button, `AUTH_SIGNUP_PAUSED`, `AUTH_RATE_LIMITED`, …).

### Step 4 — Create, update, delete

- `createAction`: reads the name from `GET /me`, fills `author_name`, sends `{ title, body, kind, author_name, is_publish: true }`. `progress` is not sent.
- `updateAction`: `{ title, body, kind, is_publish: true }`. `deleteAction`: deletes after a confirm dialog.
- After a write: `updateTag("feedback")` and `updateTag("feedback:{id}")`.
- TODO: with real members A and B — post → top of the list; B edits A's post → 403 message; edit a sample → 403; what happens without `is_publish`.

### Step 5 — Verification (2026-11-18, local `next start`, port 3004)

| Check | Result |
| --- | --- |
| `pnpm lint`, `pnpm typecheck`, `pnpm build` (real environment variables) | Pass. 12 `/f/[id]` paths prerendered |
| `/feedback-board` | 12 samples, type tabs (All 12 · Suggestion 6 · Bug Report 4 · Question 2) |
| `?kind=<Bug Report id>` | 4 rows |
| `/f/<sample id>` | Detail shown; no Edit / Delete when signed out |
| `/f/00000000-…` (unknown id) | 404 page (the API answered 200 with another row; the id check stops it) |
| `/new` signed out | Redirect to `/login?next=%2Fnew` |
| Login with a wrong password | "The e-mail or password is incorrect." |
| `pk-proj_` or the project ID in `.next/static` | 0 each |
| Key or project ID in repository files (except `.env.local`) | 0 |
| `NEXT_PUBLIC_ONTTLE*` variables | None |

### Step 6 — Deployment and gateway

- Added 2 rewrite lines to `_gateway/vercel.json`, one list item to `_gateway/public/index.html`, a row to the `_gateway/README.md` table and to the root README; wrote `feedback-board/README.md` and `.env.example`.
- The person said "deploy to Vercel directly" → done with the Vercel CLI (`vercel deploy --prod` from `feedback-board/`, no git connection).
- Created the project `onttle-examples-feedback-board` (`vercel project add`), linked `feedback-board/`, added the 5 environment variables to Production and Preview (the key as Sensitive). Values were piped from `.env.local` and never printed.
- **The first deploy failed**: `No Output Directory named "public" found`. A project created from the CLI gets the Framework Preset "Other", so the Next.js build output was not found → set `framework: nextjs` through the API and deployed again: success.
- Checked at `onttle-examples-feedback-board.vercel.app/feedback-board`: `/` 200 (samples shown), `/f/<sample id>` 200, an unknown id shows "Not found", `/new` → 307 `/login?next=%2Fnew`, `/login` and `/signup` 200, `pk-proj_` 0 times in the HTML.
- Deployment Protection stayed at the default (`all_except_custom_domains`) and the production `*.vercel.app` address still opens without a login (unlike i18n-landing). Not changed.
- Root Directory is empty, because the deploy came from the subfolder. TODO: set it to `feedback-board` when git is connected.
- The gateway was also deployed with the CLI on the person's instruction ("deploy now"). Its project has Root Directory `_gateway`, so it cannot be deployed from the subfolder: a temporary folder holding only `_gateway/` was deployed with `VERCEL_PROJECT_ID` set. Uncommitted local changes went live (2 rewrite lines, 1 list item), so **until they are merged into main, a git deploy can undo them.**
- Checked at `https://example.onttle.com/feedback-board`: `/`, detail, `/login`, `/signup`, `/verify` 200; `/new` → 307 `example.onttle.com/feedback-board/login?next=%2Fnew`; CSS 200. The existing `/`, `/blog`, `/help-center`, `/i18n-landing/ko` are still 200.
- Redeployed after the change to English (the app needed the new category names).
- TODO: on the deployed site, confirm that the link in the sign-up e-mail lands on `/feedback-board/verify` and verification completes.

## 4. Where the agent was wrong or got stuck

1. **Picked a name and was corrected.** After "not Noteforge", Claude chose "Jotfield" and got as far as the Onttle change previews. The person changed it to "MemoFarm"; the two previews were redone and applied. MCP writes are preview → confirm, so Jotfield never reached the data.
2. **Times the key or a token was put in the client: 0.** The plan fixed the BFF design, so the docs example (`NEXT_PUBLIC_` + tokens in the browser) was not followed.
3. **An unknown id answers 200.** Found by chance: a zero UUID was requested to see the 404 and another post came back. Without the check, `/f/anything` would have shown the wrong post. Whether `PUT` and `DELETE` behave the same was not checked (the samples have no owner, so the owner rule should stop it) — TODO.
4. **Page text was read before streaming finished.** Reading the filtered page as text showed only "Loading…" and looked like a bug; a screenshot showed it was fine.
5. **First Vercel deploy failed** on the Framework Preset (step 6).
6. **An MCP write said "applied" and did nothing.** The category value renames (above). It was caught only because the redeployed page was checked for leftover Korean text.
7. **Guessed the language wrong.** Korean data with an English UI followed help-center, but the person wanted English everywhere, which meant three more Onttle changes, a code change (names used as keys) and a redeploy.
8. Blocked once: the category value names needed the dashboard.

## 5. Numbers for the post

| Item | Value |
| --- | --- |
| Pages | 7 (list, detail, new, edit, sign-up, verify, login) |
| Tables | 1, with 5 columns and 2 categories (6 values) |
| Permission rules | 4 cells (public · member · owner · owner). 0 lines of permission code in the app |
| Samples | 12 |
| Test sign-ups (= credits used) | 0 so far — TODO |
| Refresh after the access token expires: works? how long? | TODO |
| Questions the person answered | 2 (the Onttle changes + name; whether to deploy the gateway) |
| Vercel deploys | feedback-board 4 (1 failed), gateway 1 |
| Time taken | TODO |

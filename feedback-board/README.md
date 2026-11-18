# A Members-Only Feedback Board Built on Onttle (feedback-board)

A Next.js feedback board where **anyone can read, members post, and only the author can edit or delete**. Sign-up, e-mail verification, login and "who may write what" all run on Onttle: there is no auth server and no database in this app.

| Who | Can |
| --- | --- |
| Visitor | Read the list and every post |
| Signed-in member | Post feedback |
| Author | Edit or delete their own posts. Another member's post answers 403 |
| Team (dashboard) | Change the progress (Pending · Planned · Complete) |

"MemoFarm" is a fictional note app made up for this example. The sample feedback and names are made up; no real company or person is used.

- Demo: https://example.onttle.com/feedback-board
- Build record: [docs/BUILD_LOG.md](docs/BUILD_LOG.md)

## Screens

Every path is under the `basePath` `/feedback-board` (local: `http://localhost:3000/feedback-board`).

| Path | What it shows | Rendering |
| --- | --- | --- |
| `/` | Feedback list, type filter (`?kind=`), 10 per page (`?page=`) | Shell prerendered; list streamed from a 60-second cache tagged `feedback` |
| `/f/[id]` | One post; Edit and Delete for signed-in members | Prerendered for every row at build time, revalidated every 60 seconds |
| `/new` | Post form | Members only (the proxy sends others to `/login?next=/new`) |
| `/f/[id]/edit` | Edit form (title, type, details) | Members only |
| `/signup` | Display name, e-mail, password, demo notice | Server Action |
| `/verify?token=…` | Confirms the link from the verification e-mail | Request time |
| `/login` | Login, with "resend the verification e-mail" when needed | Server Action |

The header shows "Log in / Sign up" or "name · Log out · New feedback". It is the only per-visitor part of the layout and streams inside `<Suspense>`.

## Onttle features used

| Feature | Endpoint | Used for |
| --- | --- | --- |
| Member API | `POST /auth/signup`, `/auth/email/verify`, `/auth/email/resend`, `/auth/login`, `/auth/token/refresh`, `/auth/logout`, `GET /me` | Accounts, e-mail verification, sessions |
| Table permission rules | `feedback`: read `public` · create `member` · update `owner` · delete `owner` | Who may do what. No permission code in the app |
| Content writes with a member token | `POST /tables/feedback`, `PUT`·`DELETE /tables/feedback/{id}` | Posting, editing, deleting. The member who posts owns the row |
| Table API (reads) | `GET /tables/feedback`, `GET /tables/feedback/{id}` | List and detail |
| Categories API | `GET /categories` | The type choices of the form (value ids) |
| Publishable key | `pk-proj_…` in `X-Onttle-Key` | Every call. No secret key in the app |

### Why a BFF, not the browser

Onttle's member docs show the browser calling the API with a `NEXT_PUBLIC_` publishable key and keeping the tokens itself. This repository keeps every Onttle call on the server, so the example puts the Next.js server in between:

- Every call lives in [`src/lib/onttle.ts`](src/lib/onttle.ts) (`import "server-only"`). The browser never calls Onttle.
- The member's tokens live in three **httpOnly** cookies scoped to `/feedback-board` ([`src/lib/session.ts`](src/lib/session.ts)): `fb_at` (access token, 15 minutes), `fb_rt` (refresh token, 30 days), `fb_name` (display name for the header). JavaScript in the page cannot read them.
- Cookies are written only in Server Actions ([`src/app/actions.ts`](src/app/actions.ts)) and in the proxy ([`src/proxy.ts`](src/proxy.ts)). Next.js does not allow setting cookies while a Server Component renders.
- When the access token has expired, the proxy refreshes the session before the page renders. Onttle's refresh tokens are single use, and sending a used one signs that login out everywhere. So prefetch requests never refresh, and concurrent requests share one refresh call. Server Actions retry once with a refreshed token after a 401.
- `author_name` is not a form field: the action fills it from `GET /me`. The form never sends `progress`.

### What the real API does (details in the build record)

- `GET /tables/feedback/{id}` with an id that does not exist answers **200 with another row**. `getFeedback()` checks that the returned id matches, so a made-up id is a 404.
- The list ignores `size` (always 50), `filter` and `fields`. The app reads every page, then filters and pages itself.
- CATEGORY columns arrive as `{ id, name }` (the spec says a uuid string). Writes send the value id.
- The responses do not say which member owns a row, so the app cannot hide Edit and Delete on other people's posts. It shows them to every signed-in member, and Onttle's `owner` rule answers 403, shown as "You can only edit or delete your own feedback."
- The `owner` rule is per row, not per column: the author could change `progress` by calling the API directly. The app does not send it, but this is a limit of the rules.

## Preparing the Onttle project

1. Create a project (004-feedback-board uses one language, `en`).
2. Table `feedback` (slug `feedback`):
   | Column | Type | Options |
   | --- | --- | --- |
   | `title` | TEXT | required, max 100 |
   | `body` | TEXT | textarea, required |
   | `kind` | CATEGORY | required, single — category "Feedback type": Suggestion, Bug Report, Question |
   | `progress` | CATEGORY | single — category "Progress": Pending, Planned, Complete |
   | `author_name` | TEXT | max 40 |
   The app finds the type choices by the category name "Feedback type" (`KIND_CATEGORY` in `src/lib/onttle.ts`).
3. Members → turn the member feature on (accept the data-processing notice), token mode **Bearer**. Allowed origins: your site and `http://localhost:3000`. Verification redirect URL: `https://<your site>/feedback-board/verify`. Set a **monthly sign-up limit**: every verified sign-up uses credits.
4. Table `feedback` → permission rules: read **public**, create **logged-in member**, update **owner**, delete **owner**.
5. API → issue a **publishable key**.
6. Optional: sample rows (the demo has 12, published, inserted with a secret key, so no member owns them and nobody can edit them).

## Running it

```bash
pnpm install
cp .env.example .env.local   # fill in the values
pnpm dev                     # http://localhost:3000/feedback-board
```

| Variable | Value |
| --- | --- |
| `ONTTLE_API_URL` | `https://api.onttle.com/v1` |
| `ONTTLE_PROJECT_ID` | Project ID |
| `ONTTLE_PUBLISHABLE_KEY` | Publishable key (`pk-proj_…`). Server only, never `NEXT_PUBLIC_` |
| `ONTTLE_FEEDBACK_TABLE` | `feedback` (slug or table id) |
| `NEXT_PUBLIC_SITE_URL` | `https://example.onttle.com/feedback-board` (local: `http://localhost:3000/feedback-board`) |

Testing sign-up locally: the verification e-mail links to the redirect URL set in Onttle (the deployed site). Copy the `?token=…` part onto `http://localhost:3000/feedback-board/verify`, or point the redirect URL at localhost while you develop.

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Deployment

Vercel project `onttle-examples-feedback-board`, Root Directory `feedback-board`, served at `https://example.onttle.com/feedback-board` through [_gateway](../_gateway). Set the five variables above in Vercel (the key as Sensitive).

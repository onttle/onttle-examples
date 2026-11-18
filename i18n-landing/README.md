# A Multilingual Landing Page Built on Onttle (i18n-landing)

A Next.js landing page in Korean and English. The texts live in three places in Onttle, by who changes them and how often:

| What | Where in Onttle | Examples |
| --- | --- | --- |
| UI texts | **Translations** (one key, one text per language) | Navigation, buttons, headings |
| Content | **Localized columns** of a table | Feature cards, plans |
| Values that change | **Variables** (`{{var_key}}` inside texts) | Free trial days, contact email, sign-up URL |

Change a text or a price in the dashboard and both languages update without a deploy.

"Pageworks" is a fictional team notes service made up for this example. No real company, person or review is used.

- Demo: https://example.onttle.com/i18n-landing
- Build record: [docs/BUILD_LOG.md](docs/BUILD_LOG.md) (in Korean)

## Screens

Every path is under the `basePath` `/i18n-landing` (local: `http://localhost:3000/i18n-landing`).

| Path | What it shows | Rendering |
| --- | --- | --- |
| `/` | Redirects to `/ko` or `/en` ([`src/proxy.ts`](src/proxy.ts)) | Per request: the `NEXT_LOCALE` cookie first, then `/en` if `Accept-Language` starts with `en`, otherwise `/ko` |
| `/ko`, `/en` | Header, hero, 6 feature cards, 3 plans, CTA, footer | Generated at build time; data cached for 5 minutes under the `landing` tag |
| any other locale (`/ja`) | 404 | |
| `POST /api/revalidate` | Clears the `landing` cache at once | Dynamic |

Opening `/ko` or `/en` stores that language in the `NEXT_LOCALE` cookie, so the next visit to `/` goes there. Each page lists the other language in `hreflang` alternate links.

## Onttle features used

| Feature | Endpoint | Used for |
| --- | --- | --- |
| Translations API | `GET /translations` | All UI texts, passed to [next-intl](https://next-intl.dev) as messages |
| Variables API | `GET /variables` | `signup_url` for the buttons |
| `{{var_key}}` substitution | inside translations and contents | `hero.subtitle` and the Pro plan summary carry `{{var_free_trial_days}}`, `footer.contact` carries `{{var_contact_email}}` |
| Localized columns | `GET /tables/{features}`, `GET /tables/{plans}` | Feature cards and plans in both languages |
| Publishable key | `pk-proj_…` | Every call is a GET, so no secret key is issued |

Every API call lives in one file, [`src/lib/onttle.ts`](src/lib/onttle.ts), and `server-only` keeps it out of the browser bundle. A publishable key may be used in a browser, but this example still reads it on the server only: the browser never calls Onttle and the key is not in the build output.

What the real responses look like (they differ from some doc examples, details in the build record):

- `GET /translations` returns a plain array of `{ key, value: { en, ko } }`, with no pagination. Variables are already replaced.
- `GET /variables` returns a plain array of `{ key, value, description }`. `value` keeps its type (`14` is a number).
- Localized columns always arrive as `{ en, ko }`. The `language` and `locale` query parameters did not change the response, so the app picks the text itself (`pick()` in [`src/i18n/locales.ts`](src/i18n/locales.ts)).

### Texts and next-intl

- Translation keys contain dots (`hero.title`). next-intl reads a dot as nesting, so [`src/i18n/messages.ts`](src/i18n/messages.ts) turns the list into a nested object before handing it over.
- A text is chosen in this order: the page language → Korean → the bundled fallback ([`src/i18n/fallback.ko.json`](src/i18n/fallback.ko.json), [`fallback.en.json`](src/i18n/fallback.en.json)). `pricing.popular` has no English text on purpose, so `/en` shows the Korean one.
- If the translations call fails, the bundled fallback is used and the build does not fail. If a table is empty or fails, its section is hidden.
- Every call passes the locale explicitly (`getTranslations({ locale })`), so next-intl never reads request headers and both pages are prerendered with Cache Components.

## Preparing the Onttle project

1. Create a project with the languages **ko and en**. Choose the languages first: localized columns are designed for them.
2. Tables:

   | Table | Columns |
   | --- | --- |
   | `features` | `title` (TEXT, required, localized), `description` (TEXT textarea, localized), `icon` (TEXT, an icon name), `order` (NUMBER) |
   | `plans` | `name` (TEXT, required, localized), `summary` (TEXT, localized), `price_krw` (NUMBER), `price_usd` (NUMBER), `included` (TEXT multiple, localized), `is_popular` (BOOLEAN), `order` (NUMBER) |

3. Add 6 features and 3 plans in both languages and **publish** them. Icon names drawn by this example: `users`, `link`, `import`, `file-down`, `search`, `shield-check` (anything else shows a dot).
4. Variables: `free_trial_days`, `contact_email`, `signup_url`.
5. Translations: `nav.features`, `nav.pricing`, `nav.contact`, `hero.title`, `hero.subtitle`, `hero.cta`, `features.heading`, `pricing.heading`, `pricing.per_month`, `pricing.popular`, `pricing.free`, `cta.title`, `cta.button`, `footer.contact`, `footer.copyright`, `lang.switch` (the name of the *other* language).
6. Turn on the Translations and Variables APIs under **API endpoints → Pre-defined API**, and issue a **publishable key**.

## Running

```bash
cp .env.example .env.local   # fill in the values
pnpm install
pnpm dev
```

| Environment variable | Description |
| --- | --- |
| `ONTTLE_API_URL` | `https://api.onttle.com/v1` (without `/v1` is fine too) |
| `ONTTLE_PROJECT_ID` | Project ID from the project settings |
| `ONTTLE_API_KEY` | Publishable key `pk-proj_…` (server only, never `NEXT_PUBLIC_`) |
| `ONTTLE_FEATURES_TABLE_ID` | ID of the `features` table, used in `/tables/{id}` |
| `ONTTLE_PLANS_TABLE_ID` | ID of the `plans` table (it has no slug, so the ID is required) |
| `REVALIDATE_SECRET` | Any random string that protects `/api/revalidate` |
| `NEXT_PUBLIC_SITE_URL` | Absolute URL including the basePath (`https://example.onttle.com/i18n-landing`), used for `hreflang` links |

```bash
pnpm lint && pnpm typecheck && pnpm build
```

## After changing a translation or a variable

Onttle webhooks fire on **content** changes only. Changing a translation or a variable sends no event, so the page shows the new text when the 5-minute cache expires, or at once after this call:

```bash
curl -X POST https://example.onttle.com/i18n-landing/api/revalidate -H "Authorization: Bearer $REVALIDATE_SECRET"
```

Changes to features and plans can call the same URL from a webhook. Webhook requests carry no signature yet, so the URL is protected with the Bearer secret. Registering the webhook is not automated here.

## Deployment (Vercel)

- Project `onttle-examples-i18n-landing`, Root Directory `i18n-landing`. The environment variables above are stored in Vercel only.
- `basePath: "/i18n-landing"`. Internal links use `next/link` so the basePath is added.
- The public domain `example.onttle.com` belongs to the [`_gateway`](../_gateway) project, which proxies `/i18n-landing/*` to `onttle-examples-i18n-landing.vercel.app/i18n-landing/*`.

## Not included

Sign-up and payment, a contact form (write API), a third language, blog or review sections, automatic AI translation, OG image generation, automatic webhook registration.

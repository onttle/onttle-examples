# An AI Help Center Built on Onttle (help-center)

A Next.js help center example: FAQs live in Onttle, and when a visitor asks a question, an Onttle Agent answers from the FAQs and shows its sources. There is no hand-built RAG pipeline or vector database, only one FAQ table, an Agent setting and one Route Handler.

"Noteforge" is a fictional service for this example. No real company documents are used, so the answers cannot be mistaken for real guidance.

- Demo: https://example.onttle.com/help-center
- Build record: [docs/BUILD_LOG.md](docs/BUILD_LOG.md) (in Korean)

## Screens

Every path is under the `basePath` `/help-center` (local: `http://localhost:3000/help-center`).

| Path | What it shows | Rendering |
| --- | --- | --- |
| `/` | FAQ list by topic (accordion) | Static shell + cached data (5 minutes, `faqs` tag) |
| `/faq/[slug]` | FAQ detail (Markdown answer) | Generated at build time; new FAQs are generated on first request and cached |
| `/search?q=` | Semantic search (Embeddings) | Per request |
| `/ask` | AI chat + source cards | Static shell + client state (calls `/api/ask` only) |
| `POST /api/ask` | Calls Chats, limits length and turns | Dynamic |
| `POST /api/revalidate` | Invalidates the `faqs` cache at once | Dynamic |

## Onttle features used

| Feature | Endpoint | Used for |
| --- | --- | --- |
| Chats (Agent + `search_type`) | `POST /chats`, `POST /chats/{chatId}/messages` (threshold 0.4) | AI chat |
| Chats message history | `GET /chats/{chatId}/messages?lastId=` | Source scores, counting turns |
| Agents | Created in the dashboard, selected with `agent_id` | Answer instructions, model, Max Tokens |
| Embeddings semantic search | `POST /tables/{faqs}/embeddings` (threshold 0.4) | Search |
| Vector sync | Dashboard | Grounding for search and AI answers |
| Categories API | `GET /categories` | Topic order |
| Contents API | `GET /tables/{faqs}`, `GET /tables/{faqs}/{slug}` | List and detail |

Every API call lives in one file, [`src/lib/onttle.ts`](src/lib/onttle.ts), and `server-only` keeps it out of the browser bundle. Chats and Embeddings are POSTs and need a **secret key**, so the browser only calls the app's own `/api/ask`.

The Chats response is a `text/plain` stream, and all the chunks concatenated form one JSON object (`chatId`, `message`, `contents`). It is not SSE, and `res.json()` cannot read it. This example reads the stream to the end on the server, parses it and returns JSON. `contents` holds only `{ id, table_id }`, so the question shown on a source card comes from the cached FAQ list and the score from the message history GET.

## Preparing the Onttle project

1. Create a project with a `faqs` table (slug enabled).

   | Column | Type | Notes |
   | --- | --- | --- |
   | `question` | TEXT | Required |
   | `answer` | TEXT (textarea) | Markdown |
   | `topic` | CATEGORY (`topic`) | account, billing, plans, collaboration, integrations, security |
   | `keywords` | TEXT (multiple) | |
   | `order` | NUMBER | List order |

2. Add FAQs and **publish** them.
3. Sync `faqs` in the **Vector** menu and check that the status is SUCCESS. Only published contents are synced.
4. Create an Agent in the **Agents** menu. Instructions used in this example: "You are the Noteforge help center assistant. Answer only from the provided FAQs. If there is no grounding, say you do not know and point to the FAQ list. Answer politely in 3–5 sentences." Keep Max Tokens short, around 500.
5. Turn on the Categories API under **API endpoints → Pre-defined API**, and issue a secret key.

> **Re-sync Vector after editing an FAQ.** The list and detail pages update right away through `/api/revalidate`, but search and AI answers use the content from the last sync.

## Running

```bash
cp .env.example .env.local   # fill in the values
pnpm install
pnpm dev
```

| Environment variable | Description |
| --- | --- |
| `ONTTLE_API_URL` | `https://api.onttle.com` (a trailing `/v1` is fine too) |
| `ONTTLE_PROJECT_ID` | Project ID from the project settings |
| `ONTTLE_API_KEY` | Secret key `sk-proj_…` (server only, never `NEXT_PUBLIC_`) |
| `ONTTLE_AGENT_ID` | Agent ID from the Agents menu |
| `ONTTLE_FAQ_TABLE_ID` | ID of the `faqs` table. The table has no slug, so the ID is used both in paths (`/tables/{id}`) and in Chats `tableIds` |
| `ASK_MAX_MESSAGE_LENGTH` | Maximum question length in characters (default 300) |
| `ASK_MAX_TURNS` | Maximum questions per chat (default 6, at most 9) |
| `ASK_SEARCH_TYPE` | `vector` · `query` · `hybrid` · `bm25` (default `hybrid`) |
| `REVALIDATE_SECRET` | Any random string that protects `/api/revalidate` |
| `NEXT_PUBLIC_SITE_URL` | Absolute URL including the basePath (`https://example.onttle.com/help-center`) |

```bash
pnpm lint && pnpm typecheck && pnpm build
```

### Instant updates

```bash
curl -X POST https://example.onttle.com/help-center/api/revalidate -H "Authorization: Bearer $REVALIDATE_SECRET"
```

## AI cost of a public demo

Each question uses AI tokens (`AI_ASK_TOKENS`) and each search uses embedding tokens (`API_EMBEDDINGS_TOKENS`). This example limits the cost as follows.

- A short Max Tokens on the Agent
- The server checks question length (`ASK_MAX_MESSAGE_LENGTH`) and questions per chat (`ASK_MAX_TURNS`). Turns are counted from Onttle's chat history, so the browser cannot bypass the limit.
- There is no per-IP rate limit. If you need one, add it in front of the app, for example with a Vercel Firewall rate limit rule.

## Deployment (Vercel)

- Project `onttle-examples-help-center`, Root Directory `help-center`. The environment variables above are stored in Vercel only.
- `basePath: "/help-center"`. Use `next/link` for links and `next/form` for forms so the basePath is added. Client-side `fetch` does not add it, so calls prepend the value from [`src/lib/base-path.ts`](src/lib/base-path.ts).

## Not included

Character-by-character streaming, saving chats or restoring them after a reload, member login, multiple languages, "Was this helpful?" feedback, a version loaded with Onttle's own docs, CAPTCHA.

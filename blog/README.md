# A Tech Blog Built on Onttle (blog)

A Next.js tech blog example that uses Onttle as a headless CMS. Posts are written in the Onttle CMS, and this app reads them through the REST API.

- Demo: https://example.onttle.com/blog
- Build record: [docs/BUILD_LOG.md](docs/BUILD_LOG.md) (in Korean)

## Screens

Every path is under the `basePath` `/blog` (local: `http://localhost:3000/blog`).

| Path | What it shows | Rendering |
| --- | --- | --- |
| `/` | Latest posts (`?page=`), tag list | Static shell + cached data (5 minutes) |
| `/posts/[slug]` | Post detail, cover image, metadata | First-page posts are generated at build time; the rest on first request, then cached |
| `/tags/[tag]` | Posts by tag | Same as above |
| `/search?q=` | BM25 keyword search | Per request (results per query cached for 5 minutes) |
| `/feed.xml` | RSS | Cached (5 minutes) |
| `POST /api/revalidate` | Invalidates the `posts` cache at once | Dynamic |

## Onttle features used

| Feature | Endpoint | Used for |
| --- | --- | --- |
| Contents list (sort, pagination) | `GET /v1/{projectId}/tables/posts?page&size&sort` | List, tags, RSS |
| Single content (by slug) | `GET /v1/{projectId}/tables/posts/{slug}` | Post detail |
| BM25 keyword search | `POST /v1/{projectId}/tables/posts/bm25` | Search (`rerank: false`) |
| Files (`s3_path` of a FILE column) | Included in the response | Cover image |
| TEXT multiple column | Included in the response | Tags |
| Webhook (optional) | Calls `/api/revalidate` when content changes | Instant updates |

Every API call lives in one file, [`src/lib/onttle.ts`](src/lib/onttle.ts), and `server-only` keeps it out of the browser bundle. BM25 search is a POST and needs a **secret key**, so it is called from server components only.

## Preparing the Onttle project

The `posts` table (slug enabled):

| Column | Type | Notes |
| --- | --- | --- |
| `title` | TEXT | Required |
| `excerpt` | TEXT (textarea) | Summary |
| `body` | TEXT (textarea) | Markdown |
| `cover_image` | FILE | Optional |
| `tags` | TEXT (multiple) | Array of tag names |

The slug, publish date (`published_at`) and publish status use Onttle's built-in fields. The project also has an `authors` table, which this example does not use.

To use search, sync the `posts` table in the **Vector** menu. Sync again after publishing or editing a post so search picks up the change.

## Running

```bash
cp .env.example .env.local   # fill in the values
pnpm install
pnpm dev
```

| Environment variable | Description |
| --- | --- |
| `ONTTLE_API_URL` | `https://api.onttle.com` |
| `ONTTLE_PROJECT_ID` | Project ID from the project settings |
| `ONTTLE_API_KEY` | Secret key `sk-proj_…` (server only, never `NEXT_PUBLIC_`) |
| `REVALIDATE_SECRET` | Any random string that protects `/api/revalidate` |
| `NEXT_PUBLIC_SITE_URL` | Absolute URL for RSS and OG, including the basePath (`https://example.onttle.com/blog`) |

```bash
pnpm lint && pnpm typecheck && pnpm build
```

### Instant updates

```bash
curl -X POST https://example.onttle.com/blog/api/revalidate -H "Authorization: Bearer $REVALIDATE_SECRET"
```

Register this URL and the `Authorization` header as an Onttle webhook, and it is called automatically whenever a post changes.

## Deployment (Vercel)

- Project `onttle-examples-blog`, Root Directory `blog`. The environment variables above are stored in Vercel only.
- `basePath: "/blog"` in `next.config.ts` puts every path under `/blog`. Use `next/link` for links and `next/form` for forms so the basePath is added.

## Not included

Comments, login, view counts, multiple languages, an AI chatbot or embeddings search, a writing UI, automatic OG image generation.

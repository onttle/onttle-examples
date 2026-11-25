# Photo Portfolio Built on Onttle (photo-portfolio)

A Next.js photo portfolio for a fictional photographer, **Seo-ha Yun**: a gallery with series tabs, a photo page, and a search that finds photos by a sentence such as "a rainy alley at night". Nobody typed the alt text or the tags: Onttle's OCR and AI description, made when each file was uploaded, fill them in, and a person's caption wins when there is one.

Seo-ha Yun is made up for this example, and the place names point to no specific place.

- Demo: https://example.onttle.com/photo-portfolio
- Build record: [docs/BUILD_LOG.md](docs/BUILD_LOG.md)

## Screens

Every path is under the `basePath` `/photo-portfolio` (local: `http://localhost:3000/photo-portfolio`). The UI and the content are in English.

| Path | What it shows | Rendering |
| --- | --- | --- |
| `/` | Two featured photos, series tabs, every photo in a 1 / 2 / 3-column grid | Static shell; the photos stream in at request time from a cache that lives half as long as the signed image URLs |
| `/series/[id]` | One series. The id is the category value id (categories have no slug) | Request time, inside `<Suspense>`, same cache |
| `/photos/[slug]` | Large image, date, place, series, keyword tags (link to search), where the alt text came from, OCR text | Request time, inside `<Suspense>`, same cache |
| `/search?q=&mode=` | Semantic search (default) or keyword search (`mode=keyword`), with a link to run the same query in the other mode | Request time, inside `<Suspense>` |

## Onttle features used

| Feature | Where | Used for |
| --- | --- | --- |
| File upload with OCR and AI description | `POST /files` with `is_ocr` and `is_generate` ([`scripts/upload-photos.ts`](scripts/upload-photos.ts)) | `description_generated` → alt text, `keywords` → tags, `text_vision` → "text in the photo" |
| Image thumbnail presets | Dashboard → Files → image thumbnails (set **before** uploading) | `thumbnails[]` → `<img srcset>`; a phone downloads a small thumbnail, not the original |
| FILE column | `photos.image` | The row's response carries the whole `ProjectFile` (thumbnails, AI description, keywords) |
| Embeddings search | `POST /tables/photos/embeddings` | "Find by a sentence". The vector sync includes the file description, so a photo with no matching title can be found |
| BM25 search (+ rerank) | `POST /tables/photos/bm25` | The same query as keyword search, to compare |
| CATEGORY column + Categories API | `photos.series`, `GET /categories` | Series tabs in the order set in the dashboard |
| Secret key on the server | `sk-proj_…` in `X-Onttle-Key`, in [`src/lib/onttle.ts`](src/lib/onttle.ts) only | Every call. The browser never calls Onttle |

### Alt text

`caption` (written by a person) → `description_generated` (written by Onttle's AI at upload) → `title`. The photo page says which one was used, and shows the AI description too when a person's caption replaced it.

### Signed URLs expire

`presigned_url` (and each thumbnail's) is a temporary URL. The Onttle FAQ says not to store it but to ask the API again. So:

- Photos are `<img srcset>` from the thumbnails, **not `next/image`**. Onttle already resized them, and the image optimizer would cache URLs that stop working.
- They live **5 minutes** (`X-Amz-Expires=300`). `listPhotos()` reads how long the URLs have left from the URLs themselves (`X-Amz-Date` + `X-Amz-Expires`, or `Expires`) and sets `cacheLife` to revalidate at half of that (150 s) and expire before it (270 s). Without either, it assumes 20 minutes.
- A cache that expires in under 5 minutes cannot be prerendered, so the photo pages are not static: each request renders inside `<Suspense>` from that shared cache. One side effect: an unknown slug shows the not-found page with status 200, because the response has already started streaming.
- The photo page and search reuse the same cached list (12 rows), so every image on the site comes from one place.
- No `og:image`: a link preview would keep a dead URL.

### Search cost guard

Each search spends embedding (or reranker) tokens, and the demo is public: queries are cut at 100 characters, an empty query makes no call, and `SEARCH_DISABLED=true` replaces the search with a notice.

## Preparing the Onttle project

1. Create a project (006-photo-portfolio has one language, `ko`, but its content is written in English).
2. Table `photos` (slug `photos`, slug support on):
   | Column | Type | Options |
   | --- | --- | --- |
   | `title` | TEXT | required |
   | `image` | FILE | single, not required (rows are made before files are linked) |
   | `caption` | TEXT | textarea. Empty → the app uses the AI description |
   | `shot_at` | DATE | — |
   | `location` | TEXT | — |
   | `series` | CATEGORY | single — category "Series" (City Nights, Sea, Alleys, Seasons) |
   | `featured` | BOOLEAN | default false |
3. Permission rules: read public, the rest Secret key only. API endpoints: list, item, embeddings and bm25 on; create, update and delete off (the app never writes).
4. Files → image thumbnails: three presets (e.g. 480, 960, 1600 px). **Before** any upload: presets apply only to files uploaded after them.
5. API → issue a **secret key** (dashboard only).
6. Upload the photos (next section), link each file to its row in the dashboard, publish the rows.
7. Vector → sync `photos`. Sync again after changing content.

## Photos

Put the images in `photo-portfolio/photos/` (git-ignored). Use photos without faces, licence plates, brand names or shop signs, and remove GPS from the EXIF first.

```bash
pnpm upload          # uploads ONE photo and prints description_generated, keywords, text_vision, thumbnails
pnpm upload --all    # the rest, after checking the first
```

The result (file ids) goes to `scripts/uploaded.json`, which is git-ignored. OCR and AI description cost credits per upload.

Photo credits: TODO.

## Running it

```bash
pnpm install
cp .env.example .env.local   # fill in the values
pnpm dev                     # http://localhost:3000/photo-portfolio
```

| Variable | Value |
| --- | --- |
| `ONTTLE_API_URL` | `https://api.onttle.com/v1` |
| `ONTTLE_PROJECT_ID` | Project ID |
| `ONTTLE_API_KEY` | Secret key (`sk-proj_…`). Server only, never `NEXT_PUBLIC_` |
| `ONTTLE_PHOTOS_TABLE` | `photos` (slug or table id) |
| `SEARCH_DISABLED` | Optional, `true` turns search off |
| `NEXT_PUBLIC_SITE_URL` | `https://example.onttle.com/photo-portfolio` (local: `http://localhost:3000/photo-portfolio`) |

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Deployment

Vercel project `onttle-examples-photo-portfolio`, Root Directory `photo-portfolio`, served at `https://example.onttle.com/photo-portfolio`. Set the variables above in Vercel (the secret key as Sensitive).

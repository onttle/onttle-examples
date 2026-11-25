# BUILD_LOG — photo-portfolio

A record for writing the post. Numbers and scenes are only what actually happened. `TODO` marks what is not filled in yet.

## Summary

| Item | Detail |
| --- | --- |
| Started | 2026-11-25 (KST) |
| Finished | TODO (done: app code, upload script, gateway entry, lint, typecheck, build and pages checked against a local mock API; series values, endpoints and 12 sample rows fixed through MCP; everything switched to English and a 13th (summer) row added. Left: Vector sync, deployment, the remaining Still-to-record items. Real build passes) |
| Built with | Claude Code (desktop app) + the Onttle MCP server (account connection) |
| Onttle project | Onttle Examples workspace · `006-photo-portfolio` (one language, ko) |
| Next.js | 16.4.6 (same version and settings as event-rsvp: Cache Components, Partial Prefetching) |
| Plan | [Onttle example plan] A photo portfolio built on Onttle (photo-portfolio, 2026-11-25) |
| Instructions from the person | "예제 추가" (add an example) + the plan link; later "모든 내용을 영문으로 변경합니다" (switch everything to English) and a Summer photo for 계절 (Seasons) |

## 1. Onttle project

State seen through MCP at the start:

- The project existed with table `photos` and category "시리즈" (Series). **0 rows**, no files (rows added later, below).
- This shell had no `ONTTLE_*` variables and there was no `photo-portfolio/.env.local` (names checked only).

### Expected vs. AI design

| Item | Plan (expected) | Project as found |
| --- | --- | --- |
| Columns | title, image, caption, shot_at, location, series, featured | **Same names, types and options** (descriptions copied from the plan) |
| `series` values | 도시의 밤 · 바다 · 골목 · 계절 (City Nights · Sea · Alleys · Seasons) | **풍경 · 인물 · 도시** (Landscape · People · City) |
| API endpoints | list, item, embeddings, bm25 on; create, update, delete off | **All seven on** |
| Read rule | public | public; create / update / delete none |

Whether this came from the dashboard AI design or was made by hand is TODO (`02-ai-table-design.png`). The app reads the series from `GET /categories` and does not depend on the names, but the plan's samples (3 per series, no people) do not fit "인물" (People).

### Fixed through MCP (the person said "고쳐 주세요", "please fix it"; preview → confirm each time)

| What | Result |
| --- | --- |
| Category "시리즈" | 풍경 · 인물 · 도시 removed (no row used them), 도시의 밤 · 바다 · 골목 · 계절 added in that order (renamed to English later, below). New value ids, so `/series/[id]` URLs follow the new ids |
| `photos` endpoints | create, update, delete **off**. list, item, embeddings, bm25 stay on |
| Sample rows | 12 rows, PUBLISHED: 3 per series, `featured` on 2 (rainy-crossing, dawn-breakwater), `caption` empty, no `image` yet. Generic place names only. 1 extra preview: the first draft had first-snow shot on 2026-12-01, a date after today; changed to 2025-12-08 before confirming |

### Switched to English (the person: "switch everything to English", plus a Summer photo for Seasons)

By then the person had uploaded the photos and linked them in the dashboard: 11 rows published with images, `first-snow` a DRAFT with its file linked.

| What | Result |
| --- | --- |
| Category | "시리즈" → "Series"; values renamed in place to City Nights · Sea · Alleys · Seasons. **Same value ids**, so `/series/[id]` URLs did not change |
| 12 rows | ~~`title` and `location` in English~~ (undone by the rollback below) (e.g. 비 내리는 교차로 → Rainy Crossing, 도심 교차로 → Downtown crossing). Published rows saved with publish on so they stay public; `first-snow` left as a DRAFT |
| New row | `summer-afternoon` "Summer Afternoon", Seasons, 2026-08-02, Riverside park, PUBLISHED, no image yet. Seasons had spring, autumn and winter but no summer |
| App | UI strings, `<html lang="en">`, dates as "March 14, 2026", site name "Seo-ha Yun Photography". The project still has one language code, `ko`; the code keeps `?language=ko` because that is the only one there is |
| **Images unlinked (agent mistake + MCP behaviour)** | The `onttle_update_contents` call that sent only `title` and `location` **also cleared `image`** on all 12 rows (row history: v3 has the file, v4 does not). Claude then tried to relink through MCP with the file ids read just before (as a string, then as a one-item array, by column name and by column id): the preview showed `null → <id>` and the call said `applied`, but the row and `onttle_search_files` usage still showed no file. The site showed "No photos yet" again. Not retried further. |
| Rollback (the person chose "MCP로 롤백", roll back through MCP) | `onttle_rollback_contents` on each of the 12 rows to v3, the last revision with `image` (preview → confirm each; tried on rainy-crossing first, `onttle_search_files` usage then showed the row). All 12 files linked again, status kept (11 PUBLISHED, first-snow DRAFT). **Side effect: `title` and `location` are Korean again**; the category names stay English. Do not change those two through `onttle_update_contents` again: edit them in the dashboard. The site showed all 13 images (2 featured + 11) after the rollback |
| Titles in the dashboard (the person) | All 12 titles back in English, edited in the dashboard; images stayed linked. Some differ from the MCP draft (e.g. "A Day of Falling Cherry Blossoms"). Seen at the same time: `first-snow` published with a new image file, the `summer-afternoon` row no longer in the table (12 rows), locations being moved to English in the dashboard (7 of 12 done when Claude checked) |
| Locations in the dashboard (the person) | All 12 locations in English. The site then showed no Korean on `/`, a series page or a photo page |
| Not changed | `docs/POST.md` stays Korean like the other examples' posts. The files' `description_generated` / `keywords` were generated at upload and are not edited by this; Vector needs a re-sync after the title changes |

Until each row gets its image, the app shows "No photos yet": rows without an image are skipped on purpose.

## 2. Spec vs. plan

Read from the project's OpenAPI spec (`onttle_get_openapi_spec`, full).

| Item | Plan / docs | Spec |
| --- | --- | --- |
| Upload OCR / AI parameters | Upload doc example `isOcr`; member API `is_ocr` · `is_generate` | `POST /files` multipart: `file`, `name`, `is_ocr`, `is_generate`. The script uses these two |
| Search paths | `POST /tables/{tableId}/embeddings` · `/bm25`, needs `ONTTLE_PHOTOS_TABLE_ID` | `POST /tables/photos/embeddings` · `/tables/photos/bm25`: the **slug** works. `ONTTLE_PHOTOS_TABLE_ID` dropped; `ONTTLE_PHOTOS_TABLE=photos` as in the other examples |
| Embeddings body | [check spec] | `{ query, threshold (default 0.7), count (default 5) }` → `{ list: [...row, score] }` |
| BM25 body | [check spec] | `{ query, count, threshold, rerank (default true, billed as AI Ask), candidates, k1, b }` → `{ list: [...row, score, bm25_score], reranked }` |
| Category filter on the list | [check spec] | `filter` (JSON conditions) exists, but the operator names are not listed. Not used: 12 rows are filtered in the app |
| Item by slug | [check slug path] | `GET /tables/photos/{id}`, "Resource identifier". event-rsvp found it takes the slug too. Not used: the photo page reads from the cached list, so its URLs expire on the same clock as the gallery |
| Auth header | — | Spec: `bearerAuth`. The code sends `X-Onttle-Key` like the other examples. Confirmed: `X-Onttle-Key` with the real secret key returns 200 |
| `ProjectFile` | TypeScript doc | `id, name, description, meta (width, height, exif…), s3_path, presigned_url, thumbnails[{ path, presigned_url, size, width, height }], text_vision, description_generated, keywords[]` |
| Series URL | `/series/[slug]` | Category values have no slug → `/series/[id]` with the category value id |

## 3. Steps

| Step | What happened |
| --- | --- |
| 1. Environment and spec | Env missing, project found through MCP (section 1). Spec read (section 2). Response shapes **not measured yet**: no key, no rows |
| 2. Upload script | `scripts/upload-photos.ts` (`pnpm upload`). First run uploads one photo and prints `description_generated`, `keywords`, `text_vision`, thumbnails; `--all` for the rest. Stops at the first error, no retries with other names. Not run: no photos, no key |
| 3. Skeleton and list | Config copied from event-rsvp (no shared code). `src/lib/onttle.ts`: `listPhotos`, `getPhoto`, `listSeries`, `listBySeries`. `/` and `/series/[id]` |
| 4. Photo page and AI alt | `/photos/[slug]`: alt from caption → AI → title, the source shown, keyword tags → search, OCR text |
| 5. Search | `searchPhotos(q, mode)`, `/search`. 100-character limit, no call for an empty query, `SEARCH_DISABLED` |
| 6. Wrap-up | `_gateway/vercel.json` two rewrites, `_gateway/public/index.html` one item. README, `.env.example`. Deployment TODO |

### Decisions

- **The real URL lifetime is 5 minutes, so the photo pages are not prerendered.** Measured on 2026-11-25 with the real key (a throwaway script printed only the query keys and seconds left, not the URLs): every `presigned_url` and thumbnail URL is S3 SigV4 with `X-Amz-Expires=300`. The first real `pnpm build` then failed on `/`: "A nested `use cache` with a short `expire` (under 5 minutes) is inside an outer `use cache` that has no `cacheLife()`". The outer one was `listSeries()`, which was cached and called `listPhotos()`. Fix: only the categories are cached in `listSeries()` (`getCategories()`, 10 min), `generateStaticParams` is gone from `/photos/[slug]` and `/series/[id]`, and both pages render inside `<Suspense>` at request time from the 150 s / 270 s photo cache. Build passes: `/` and `/search` partial prerender, the two dynamic routes partial prerender with streamed content. Trade-off: an unknown slug answers 200 with the not-found page (the stream has already started). The plan's "revalidate = half the lifetime" still holds; what changed is that half of 5 minutes is too short for a static page

- **Cache time from the URL, not a constant.** The plan asked to measure the URL lifetime in step 1 and set `revalidate` to half of it. Since there was nothing to measure yet, `listPhotos()` reads the lifetime from each URL (`X-Amz-Date` + `X-Amz-Expires`, or `Expires`) and calls `cacheLife({ revalidate: lifetime / 2, expire: lifetime × 0.9 })`, minimum 60 s; 20 minutes when the URL carries neither. With a mock 1-hour URL the build reported `/photos/*` revalidate ≈30m, expire ≈54m (`/` and `/series/*` show 10m because `listSeries` caches the categories for 10 minutes). Real expiry: 300 s, S3 SigV4 format (see the first decision).
- **`<img srcset>`, not `next/image`.** As the plan says. `sizes` matches the 1 / 2 / 3-column grid.
- **Search hits are matched to the cached list by id**, so search shows the same URLs as the rest of the site and drops rows that have no image.
- **Embeddings threshold 0.5** (spec default 0.7). First set to 0.3 so a 12-photo set would return something; the real 5-query table showed 0.3 returns 10 of 12 photos for "blue sea". Right photos scored 0.58–0.80, unrelated ones 0.37–0.51, so 0.5
- **Search calls time out after 10 s.** Found when Onttle was slow (below): without a timeout the page sat on "Searching…" for 30 s and longer. Now it shows "Search is not working right now" after 10 s (checked)

## Search: 5 queries (2026-11-25, after the person's Vector sync)

Run once with the real key by a throwaway script (embeddings `count 12, threshold 0.3`; bm25 `count 12`, rerank on by default). Score, top 3:

| Query | Embeddings | BM25 + rerank |
| --- | --- | --- |
| a rainy alley at night | last-bus 0.78 · rainy-crossing 0.73 · stair-alley 0.62 (11 hits) | rainy-crossing 0.62 · menu-board 0.58 · last-bus 0.55 (8) |
| blue sea | winter-sea 0.72 · low-tide 0.63 · dawn-breakwater 0.60 (10) | dawn-breakwater 0.50 · winter-sea 0.40 · neon-window 0.20 (4) |
| a sign with writing on it | menu-board 0.58 · neon-window 0.50 · rainy-crossing 0.40 (4) | neon-window 0.85 · menu-board 0.70 · rainy-crossing 0.65 (11) |
| autumn leaves | autumn-leaves 0.80 · cherry-blossom 0.46 · last-bus 0.40 (7) | autumn-leaves 0.95 (1) |
| a street with no people | old-town-alley 0.66 · menu-board 0.54 · last-bus 0.53 (10) | old-town-alley 0.85 · last-bus 0.65 · menu-board 0.35 (9) |

- Embeddings put the right photo first in 4 of 5. Its miss: "a rainy alley at night" ranks the bus stop above the rainy crossing.
- BM25 + rerank found "autumn leaves" alone and "a street with no people" well, but "blue sea" had a lit window in third.
- All 10 calls answered 200. `reranked: true` on every BM25 call (billed as AI Ask). Credits: TODO from the usage screen.

**Onttle slow afterwards.** About 10 minutes later the same calls were slow from this machine: list 19 s, categories 9 s, embeddings and bm25 timed out at 40 s. The site's search then hung (see the timeout decision). Cause unknown. Recorded as seen, not retried in a loop.

## 4. Checked without real data

No key, so `pnpm build` with no env fails at "Failed to collect page data for /series/[id]" (`ONTTLE_PROJECT_ID must be set`). To check the pages, Claude ran a throwaway mock of the four endpoints (spec-shaped rows: three photos with an S3-style 1-hour URL and three thumbnails, one row without an image; not committed):

| Check | Result |
| --- | --- |
| `pnpm lint`, `pnpm typecheck` | Pass (no env needed) |
| `pnpm build` against the mock | Pass. 3 photo pages and 3 series pages prerendered; revalidation as above |
| alt | caption / AI description / title each used where expected |
| Row without an image | Not shown |
| Phone (375 px, DPR 2) | Grid loads the 960 w thumbnail, not the 3000 px original |
| Unknown slug | Not-found page |
| `.next/static` | No `sk-proj`, `ONTTLE_API_KEY` or `X-Onttle-Key` |

None of this says what Onttle really returns. Everything below is TODO.

## 5. Still to record (from the plan)

- [ ] Upload parameter names really used and which fields each one fills
- [ ] Which language `description_generated` and `keywords` come back in now that the content is English (they were generated at upload, before the switch)
- [ ] The 13 `description_generated` texts and the final captions: kept / fixed / dropped counts
- [ ] Average keyword count, share usable as tags, whether they are Korean
- [x] Real `presigned_url` lifetime and the resulting revalidate: 300 s → revalidate 150 s, expire 270 s, pages at request time (see Decisions)
- [x] 5 queries × embeddings vs. bm25, top 3 each: see "Search: 5 queries" below
- [ ] Credits used (OCR, embeddings, reranker) from the usage screen
- [ ] Times the agent was wrong, and the real time spent (so far: updating rows through MCP without checking that FILE values survive a partial update)
- [ ] Screenshots in `docs/assets/` (7, see the plan)

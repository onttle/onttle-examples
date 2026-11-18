# BUILD_LOG — blog

글감용 기록입니다. 숫자와 장면은 실제로 일어난 것만 적습니다. `TODO`는 아직 채우지 못한 칸입니다.

## 요약

| 항목 | 내용 |
| --- | --- |
| 시작 | 2026-11-18 (KST) |
| 종료 | TODO |
| 만든 도구 | Claude (Cowork 세션) + Onttle MCP 서버(계정 연결) |
| Onttle 프로젝트 | Onttle Examples 워크스페이스 · `001-blog` |
| Next.js | 16.4.6 (`create-next-app` 기본값: Cache Components, Partial Prefetching 켜짐) |

## 1. Onttle 프로젝트

- 프로젝트 `001-blog` (Onttle Examples 워크스페이스, 언어 ko·en). 대시보드에서 생성 — Onttle MCP에는 프로젝트 생성 도구가 없음.
- 프로젝트 설명에 기획서의 "예상 테이블" 표를 넣었고, 생성 직후 테이블 `posts`, `authors`가 있었음. TODO: 이 테이블을 AI 설계로 만들었는지, 설계 화면 캡처(`02-ai-table-design.gif`) 확보 여부

### 예상 테이블 vs 실제 테이블

| | 기획서의 예상 | 실제 (생성 직후) |
| --- | --- | --- |
| posts | title, slug(고유), excerpt, body(마크다운), cover_image, published_at, status | excerpt(TEXT textarea), body(TEXT textarea, 마크다운), cover_image(FILE), tags(TEXT multiple). slug는 테이블 옵션으로 켜짐. published_at·status는 Onttle 기본 필드 |
| tags | 별도 테이블, 다대다 | 별도 테이블 없이 posts의 TEXT multiple 컬럼 |
| authors | name, bio, avatar | name(필수), bio, avatar — **posts와 관계(참조) 컬럼 없음** |

- body가 EDITOR가 아니라 TEXT(마크다운)라 앱은 문자열을 그대로 `react-markdown`에 넘김.
- authors는 만들어졌지만 posts에서 참조하지 않아 이 예제에서는 쓰지 않음.

### MCP로 손댄 것과 사고 하나

1. `onttle_get_schema` 결과에 posts의 `title` 컬럼이 **보이지 않아** 제목 컬럼이 없는 줄 알고 `onttle_update_table`로 `title`(TEXT, 필수)을 추가.
2. 적용 결과에 `title`이 두 개(기존 `e45c48b3…`, 새 `9b5b3806…`). 미리보기는 이름 중복을 경고하지 않았음.
3. API 응답은 컬럼 이름으로 키를 잡으므로 충돌 → MCP로는 컬럼 삭제가 불가해 대시보드에서 새 컬럼 삭제.

교훈: 스키마 조회 결과를 믿기 전에 대시보드나 `onttle_search_contents`의 columns로 한 번 더 확인. Onttle 쪽 개선점: 스키마 조회 누락, 중복 이름 경고 없음 (TODO: 원인 확인 후 이슈화)

## 2. 단계별 기록

### 1단계 — 문서·명세로 API 확인

Onttle MCP `onttle_search_docs`, `onttle_get_api_reference`, `onttle_get_openapi_spec`으로 확인한 것:

| 쓸 것 | 확인한 경로/형식 |
| --- | --- |
| 목록 | `GET /tables/{table}` · `page`, `size`(최대 1000), `sort`·`filter`는 JSON 배열 문자열 |
| 단건 | `GET /tables/{table}/{id}` · `{id}`는 content id **또는 slug** |
| 응답 | `{ list, pagination: { page, total, … } }`, 항목은 `{ id, slug, published_at, data: { … } }` |
| 검색 | `POST /tables/{table}/bm25` · 시크릿 키 필요, Vector 동기화 필요, `rerank: false`면 AI 토큰 미사용 |
| 파일 | FILE 컬럼은 `ProjectFile` 객체, `s3_path`가 `https://file.onttle.com/...` |

**문서끼리 어긋난 곳 (에이전트가 틀리기 쉬운 지점)**

1. 목록 경로: 「요청 예시」·「파일 업로드」 문서의 코드는 `/tables/posts/contents`, 「엔드포인트」 문서와 OpenAPI 명세는 `/tables/posts`. 명세 기준으로 `/tables/posts`를 썼습니다.
2. OpenAPI의 `TableItem_*` 스키마는 컬럼을 최상위에 두지만(`title`), 응답 형식 문서와 MCP의 TypeScript 타입은 `data.title`. 타입은 MCP TypeScript 기준으로 썼습니다. → TODO: 실제 응답으로 확인
3. OpenAPI의 `sort` 설명은 `name:asc`, 요청 예시 문서는 JSON 배열 `[{ i, o }]`. JSON 배열을 썼습니다. → TODO: 실제 응답으로 확인
4. 목록 응답의 페이지 크기 필드: 문서는 `pagination.limit`, OpenAPI는 `pagination.size`·`totalPages`. 앱은 `total`만 써서 직접 계산합니다.

### 2단계 — 뼈대와 API 모듈

- `create-next-app@latest` → Next.js 16.4.6. **Cache Components가 기본으로 켜져** 있어 기획서의 `fetch(..., { next: { revalidate } })` 대신 `'use cache'` + `cacheLife({ revalidate: 300 })` + `cacheTag('posts')`로 바꿨습니다.
- `revalidateTag(tag)` 한 인자 형태는 16에서 deprecated → `revalidateTag('posts', 'max')`.
- `PageProps<'/posts/[slug]'>` 같은 라우트 타입은 `next typegen` 전에는 `tsc`가 실패합니다 → `typecheck` 스크립트를 `next typegen && tsc --noEmit`으로.
- `src/lib/onttle.ts` 맨 위 `import "server-only"`.

### 3~5단계 — 화면

- 목록: 서버 페이지네이션(`page`, `size=10`, `published_at` 내림차순).
- 상세: `generateStaticParams`는 첫 페이지 글만, 나머지는 첫 요청 때 생성. 본문(마크다운 문자열)은 `react-markdown` + `remark-gfm`으로 (raw HTML 미렌더링).
- 없는 slug: `notFound()`가 Suspense 안에서 호출돼 404 화면은 나오지만 상태 코드는 200(+`noindex`). 스트리밍 응답의 한계.
- 태그: 발행 글 전체(100건씩 끝까지)를 캐시해 서버에서 거름.
- 검색: 서버 컴포넌트에서 BM25(`rerank: false`, `count: 20`) 호출, 폼은 GET 제출. 검색 결과는 발행 목록에 있는 글만 남김.

### 6단계 — 재검증·마무리

- `POST /api/revalidate` (Bearer `REVALIDATE_SECRET`, `timingSafeEqual`).
- 로컬 목(mock) API로 `pnpm lint`, `pnpm typecheck`, `pnpm build` 통과 (2026-11-18). 실제 Onttle 프로젝트 연결 확인은 TODO.

### 7단계 — 배포 준비 (example.onttle.com/blog)

- `basePath: "/blog"`. 공개 도메인은 `_gateway` 프로젝트가 갖고 `/blog/*`를 `onttle-examples-blog.vercel.app/blog/*`로 프록시 (예제마다 별도 Vercel 프로젝트).
- basePath가 안 붙던 곳: 일반 `<form action="/search">`, `<a href="/feed.xml">` → `next/form`, `next/link`로 교체. `NEXT_PUBLIC_SITE_URL`에 `/blog` 포함 (metadataBase가 경로를 이어 붙임).
- 실제 프로젝트 연결 빌드에서 `generateStaticParams`가 빈 배열 → Cache Components 빌드 실패. 글이 없을 때 자리표시 경로(`_`, 404) 하나를 돌려주도록 수정.

## 3. 막힌 점과 우회

| 문제 | 우회 |
| --- | --- |
| MCP로 프로젝트를 만들 수 없음 | 대시보드에서 생성 |
| 시크릿 키는 대시보드에서만 발급 (MCP는 게시용만) | 대시보드에서 발급해 Vercel 환경변수에만 저장 |
| REST 문서에 `filter` 연산자 목록이 없음 (MCP `onttle_search_contents` 설명에는 `equals`, `contains`, `has` 등이 있음). TEXT multiple 값으로 거르는 방법 미확인 | 태그 페이지는 전체 목록을 받아 서버에서 거름 (글이 수백 건 넘으면 재검토) |
| Cache Components에서 `generateStaticParams`가 빈 배열이면 빌드 실패 (발행 글 0건일 때) | 자리표시 param 하나 반환 |
| BM25는 Vector 동기화 기준이라 글을 고친 뒤 재동기화 필요 | README에 안내. 결과는 발행 목록과 교차 확인 |

## 4. 글에서 쓸 숫자 (TODO)

- 에이전트가 틀린 횟수와 내용:
- 사람이 직접 고친 줄 수 / 에이전트가 쓴 줄 수:
- 실제 걸린 시간:
- 한글 검색 확인 ("에이전트를"로 "에이전트"가 걸리는지):

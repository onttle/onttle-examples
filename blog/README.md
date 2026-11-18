# Onttle로 만드는 기술 블로그 (blog)

Onttle을 헤드리스 CMS로 쓰는 Next.js 기술 블로그 예제입니다. 글은 Onttle CMS에서 쓰고, 이 앱은 REST API로 읽어 보여줍니다.

- 데모: https://example.onttle.com/blog
- 기획서: [Onttle 예제 기획서 — blog](https://claude.ai/artifact/6viTrCwX8pS16NGpje9Zii)
- 만든 기록: [docs/BUILD_LOG.md](docs/BUILD_LOG.md)

## 화면

경로는 모두 `basePath` `/blog` 아래입니다 (로컬: `http://localhost:3000/blog`).

| 경로 | 내용 | 렌더링 |
| --- | --- | --- |
| `/` | 최신 글 목록 (`?page=`), 태그 목록 | 정적 셸 + 캐시된 데이터 (5분) |
| `/posts/[slug]` | 글 상세, 커버 이미지, 메타데이터 | 첫 페이지 글은 빌드 때 생성, 나머지는 첫 요청 때 생성 후 캐시 |
| `/tags/[tag]` | 태그별 글 목록 | 위와 같음 |
| `/search?q=` | BM25 키워드 검색 | 요청마다 (검색어별 결과는 5분 캐시) |
| `/feed.xml` | RSS | 캐시 (5분) |
| `POST /api/revalidate` | `posts` 캐시 즉시 무효화 | 동적 |

## 사용한 Onttle 기능

| 기능 | 엔드포인트 | 쓰는 곳 |
| --- | --- | --- |
| 콘텐츠 목록 (정렬·페이지네이션) | `GET /v1/{projectId}/tables/posts?page&size&sort` | 목록, 태그, RSS |
| 콘텐츠 단건 (slug로 조회) | `GET /v1/{projectId}/tables/posts/{slug}` | 글 상세 |
| BM25 키워드 검색 | `POST /v1/{projectId}/tables/posts/bm25` | 검색 (`rerank: false`) |
| 파일 (FILE 컬럼의 `s3_path`) | 응답에 포함 | 커버 이미지 |
| TEXT multiple 컬럼 | 응답에 포함 | 태그 |
| Webhook (선택) | 콘텐츠 변경 시 `/api/revalidate` 호출 | 즉시 반영 |

API 호출은 모두 [`src/lib/onttle.ts`](src/lib/onttle.ts) 한 파일에 있고, `server-only`로 브라우저 번들에 들어가지 않게 막았습니다. BM25 검색은 POST라 **시크릿 키**가 필요하므로 서버 컴포넌트에서만 부릅니다.

## Onttle 프로젝트 준비

`posts` 테이블 (slug 지원):

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| `title` | TEXT | 필수 |
| `excerpt` | TEXT (textarea) | 요약 |
| `body` | TEXT (textarea) | 마크다운 |
| `cover_image` | FILE | 선택 |
| `tags` | TEXT (multiple) | 태그 이름 배열 |

slug·발행일(`published_at`)·발행 상태는 Onttle 기본 필드를 씁니다. 프로젝트에는 `authors` 테이블도 있지만 이 예제에서는 쓰지 않습니다.

검색을 쓰려면 **Vector** 메뉴에서 `posts` 테이블을 동기화하세요. 글을 새로 발행하거나 고친 뒤에도 다시 동기화해야 검색에 반영됩니다.

## 실행

```bash
cp .env.example .env.local   # 값 채우기
pnpm install
pnpm dev
```

| 환경변수 | 설명 |
| --- | --- |
| `ONTTLE_API_URL` | `https://api.onttle.com` |
| `ONTTLE_PROJECT_ID` | 프로젝트 설정의 Project ID |
| `ONTTLE_API_KEY` | 시크릿 키 `sk-proj_…` (서버 전용, `NEXT_PUBLIC_` 금지) |
| `REVALIDATE_SECRET` | `/api/revalidate` 보호용 임의 문자열 |
| `NEXT_PUBLIC_SITE_URL` | RSS·OG 절대 URL, basePath 포함 (`https://example.onttle.com/blog`) |

```bash
pnpm lint && pnpm typecheck && pnpm build
```

### 즉시 반영

```bash
curl -X POST https://example.onttle.com/blog/api/revalidate -H "Authorization: Bearer $REVALIDATE_SECRET"
```

Onttle Webhook에 이 URL과 `Authorization` 헤더를 등록하면 글을 고칠 때 자동으로 호출됩니다.

## 배포 (Vercel)

- 프로젝트 `onttle-examples-blog`, Root Directory `blog`. 위 환경변수는 Vercel에만 저장합니다.
- `next.config.ts`의 `basePath: "/blog"`로 모든 경로가 `/blog` 아래에 생깁니다. 링크는 `next/link`, 폼은 `next/form`을 써야 basePath가 붙습니다.
- 공개 도메인 `example.onttle.com`은 [`_gateway`](../_gateway) 프로젝트가 갖고, `/blog/*`를 `onttle-examples-blog.vercel.app/blog/*`로 프록시합니다.

## 이번에 하지 않은 것

댓글, 로그인, 조회수, 다국어, AI 챗봇·임베딩 검색, 글쓰기 UI, OG 이미지 자동 생성.

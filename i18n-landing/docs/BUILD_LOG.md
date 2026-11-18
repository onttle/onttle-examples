# BUILD_LOG — i18n-landing

글감용 기록입니다. 숫자와 장면은 실제로 일어난 것만 적습니다. `TODO`는 아직 채우지 못한 칸입니다.

## 요약

| 항목 | 내용 |
| --- | --- |
| 시작 | 2026-11-18 (KST) |
| 종료 | TODO (배포·캡처·변수 변경 확인이 남음) |
| 만든 도구 | Claude Code (데스크톱 앱) + Onttle MCP 서버(계정 연결) |
| Onttle 프로젝트 | Onttle Examples 워크스페이스 · `003-i18n-landing` (en, ko · 기본 언어 **en**) |
| Next.js | 16.4.6 (help-center와 같은 버전·설정. Cache Components, Partial Prefetching 켜짐) + next-intl 4.15.1 |
| 기획서 | Onttle 예제 기획서 — i18n-landing (2026-11-18) |
| 사람이 준 지시 | 기획서 첨부 + "003-i18n-landing 생성" 한 줄 |

## 1. Onttle 프로젝트

시작 시점에 MCP로 본 상태:

| 항목 | 기획서 | 실제 |
| --- | --- | --- |
| 프로젝트 | 대시보드에서 생성 | 이미 있음 |
| 기본 언어 | ko | **en** (언어는 en, ko 둘 다 있음). 앱의 폴백 순서(locale → ko → 키)는 기획서대로 ko로 둠 |
| 테이블 | features, plans | 둘 다 있음. 아래 표 |
| 콘텐츠 | features 6, plans 3 | 첫 조회 때 **0건**, 몇 분 뒤 다시 보니 6건·3건 (모두 PUBLISHED) — 아래 "틀린 곳 1" |
| 번역 | 25개 내외 | **16개** (이미 있음). `pricing.popular`의 en 값만 비어 있음 |
| 변수 | 3개 | 3개 (이미 있음). `free_trial_days`는 NUMBER, `contact_email`은 EMAIL, `signup_url`은 URL 타입 |
| 사전 정의 API | 번역·변수만 켜기, OpenAPI URL 켜기 | 번역·변수·**파일·카테고리 모두 켜짐**, OpenAPI URL은 **꺼짐** (명세는 MCP `onttle_get_openapi_spec`로 읽음) |
| API 키 | 게시용 키 1개 | 0개 → MCP `onttle_create_api_key`로 게시용 키 1개 발급 (허용 호스트 없음, 만료 없음). 시크릿 키는 없음 |

- 번역·변수는 기획서 2단계에서 Claude Code가 만들 예정이었지만 이미 들어 있어 만들지 않았습니다.
- 게시용 키는 MCP가 한 번만 돌려주는 값을 `.env.local`(gitignore)에 바로 적었습니다. 채팅·문서·커밋에는 남기지 않았습니다.

### 예상 테이블 vs 실제 테이블

| | 기획서의 예상 | 실제 |
| --- | --- | --- |
| features | title(TEXT, 필수, localization), description(TEXT textarea, localization), icon(TEXT), order(NUMBER) | **예상과 같음** |
| plans | name(TEXT, 필수, localization), summary(TEXT, localization), price_krw(NUMBER), price_usd(NUMBER), included(TEXT multiple, localization), is_popular(BOOLEAN), order(NUMBER) | **예상과 같음** |
| 가격 | 언어별 다국어 TEXT로 나올 수 있음 | NUMBER 두 컬럼 그대로. 통화 CATEGORY 없음, `included` 별도 테이블 없음 |
| 테이블 slug | 비어 있을 수 있음 | features는 `features`, **plans는 비어 있음** → 두 테이블 모두 id_nano를 환경변수로 씀 |
| 권한·엔드포인트 | — | read `public`, create/update/delete `none`. Embeddings·BM25 엔드포인트도 켜져 있음 (쓰지 않음) |

- 스키마는 손대지 않았습니다.
- 실제 샘플: features의 `order`는 10~60 (10 단위), 아이콘 이름은 `users`, `link`, `import`, `file-down`, `search`, `shield-check`. plans는 Free 0원·$0, Pro 8,000원·$6, Business 15,000원·$11. Pro의 summary(ko·en)에 `{{var_free_trial_days}}`.

## 2. 단계별 기록

기획서 5절의 프롬프트를 사람이 하나씩 넣지 않았고, 기획서 전체를 첨부한 한 번의 지시로 1~6단계를 이어서 진행했습니다. 사람에게 물은 것은 두 가지(샘플 콘텐츠 넣기, 게시용 키 발급)입니다.

### 1단계 — 환경·규칙·명세 읽기

- 이 셸에는 `ONTTLE_*` 환경변수가 하나도 없었습니다 (이름만 확인). 루트 `.env.local`에는 Vercel CLI 값뿐. 프로젝트 ID·테이블 ID는 MCP에서, 키는 새로 발급, `REVALIDATE_SECRET`은 `openssl rand`로 만들어 `i18n-landing/.env.local`에 적었습니다.
- 그다음 게시용 키로 실제 호출을 했습니다.

**문서·명세와 실제 응답 비교**

| 호출 | 문서·명세 | 실제 응답 (2026-11-18) |
| --- | --- | --- |
| `GET /translations` | 번역 문서 3단계: 배열 / next-intl 예제: `const { list } = await res.json()` | **배열.** `[{ key, value: { en, ko } }]`. `list`·`pagination` 없음. `page`·`size`를 줘도 16개 전부 옴 |
| 번역 항목의 필드 이름 | 기획서: `{ key, values }` | **`value`** (단수). MCP TypeScript의 `Translation`과 같지만 `description`은 오지 않음 |
| 비어 있는 언어 | — | 키가 빠지지 않고 **빈 문자열** `""`로 옴 (`pricing.popular.en`) → `??`가 아니라 `||`로 폴백해야 함 |
| 번역 안 `{{var_key}}` | 치환된다고 설명 | **치환됨.** `hero.subtitle` → "14일", `footer.contact` → 이메일 |
| `GET /variables` | 변수 문서: `{ list, pagination: { page, limit, total } }` | **배열.** `[{ key, value, description }]`. `value`는 타입 유지 (`14`는 숫자) |
| `GET /variables/{key}` | 변수 문서에 있음 | **404.** OpenAPI 명세에도 이 경로는 없음. 앱은 쓰지 않음 |
| `GET /tables/{id}` 항목 | MCP TypeScript: `{ id, created_at, updated_at, published_at, data }` | 같음. 단 **`created_at`·`published_at`이 `{}`(빈 객체)** 로 옴 (MCP로 보면 ISO 문자열). 앱은 날짜를 쓰지 않아 타입에 넣지 않음. `slug` 필드는 없음 (slug 미지원 테이블) |
| 다국어 컬럼 | 개념 문서: `?locale=ko` / API 레퍼런스: `language` 파라미터 | **둘 다 응답이 그대로.** 파라미터가 있든 없든 `{ en, ko }` 객체. multiple 컬럼은 `{ en: [...], ko: [...] }` |
| 콘텐츠 안 `{{var_key}}` | 치환된다고 설명 | **치환됨** (다국어 컬럼 안에서도). MCP로 본 원문은 `{{var_free_trial_days}}`, API 응답은 "14" |
| 목록 `size` | 명세: 기본 20, 최대 1000 | `size=100` → `pagination.size`가 **50** (help-center와 같음) |
| 테이블 경로 | OpenAPI: plans는 UUID, features는 slug | id_nano(21자)로 둘 다 동작. features는 slug로도 동작 |
| 인증 헤더 | API 레퍼런스: `X-Onttle-Key` (Bearer도 허용) | `Authorization: Bearer`로 동작 (help-center와 같게) |
| Webhook | Webhook 문서: Contents 변경에만 발생 | 문서로만 확인. 번역·변수 변경은 이벤트 없음 → 수동 재검증 또는 5분 만료 |

- 비활성 변수일 때 `{{var_key}}`가 어떻게 나오는지는 TODO (변수를 꺼 봐야 해서 하지 않음). 문서 FAQ는 "비활성화한 변수는 API로 조회되지 않는다"고만 함. 앱은 남은 중괄호가 next-intl ICU 파서에 걸리지 않도록 이스케이프합니다.

### 2단계 — 번역·변수 넣기

하지 않았습니다. 시작할 때 이미 16개·3개가 들어 있었습니다. `onttle_list_translations`(en 누락 1개: `pricing.popular`)와 `onttle_list_variables`로 확인만 했습니다.

### 3단계 — 뼈대와 API 모듈

- `pnpm new`가 없어 help-center의 설정 파일(`tsconfig.json`, eslint, `.gitignore`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `next.config.ts`, `AGENTS.md`)을 복사하고 `package.json`에서 react-markdown·typography를 빼고 next-intl을 더했습니다.
- `src/lib/onttle.ts`: `getTranslations`, `getVariables`, `listFeatures(locale)`, `listPlans(locale)`. 맨 위 `import "server-only"`.
- 기획서와 다르게 한 것: **목록 호출에 언어 파라미터를 보내지 않습니다.** 응답이 언어와 무관하게 같아서, 테이블당 한 번만 받아 캐시하고(`listRows`) `pick(value, locale)`로 골라 평평한 타입(`Feature`, `Plan`)으로 돌려줍니다. 호출 수는 언어 2개에 4번 (번역·변수·features·plans).
- 50씩 `totalPages`까지 받고 서버에서 `order`로 정렬.

### 4단계 — 다국어 라우팅과 번역 연결

- `src/proxy.ts`: `/` → 쿠키 `NEXT_LOCALE` → `Accept-Language`가 en으로 시작하면 `/en`, 아니면 `/ko` (307, `Cache-Control: private, no-store`). 쿠키를 심는 곳이 기획서에 없어서, `/ko`·`/en`을 열 때 프록시가 쿠키를 심도록 했습니다 (클라이언트 JS 없음).
- `src/app/[locale]/layout.tsx`가 루트 레이아웃 (`<html lang>`). `generateStaticParams` → ko, en. 그 외 locale은 페이지에서 `notFound()`.
- next-intl `getRequestConfig`(`src/i18n/request.ts`) → `getMessages(locale)`가 번역 목록을 **중첩 객체**로 바꿔 넘김. 고르는 순서: locale → ko → 번들 폴백 JSON.
- **next-intl과 Cache Components는 충돌하지 않았습니다.** 조건은 모든 호출에 locale을 직접 넘기는 것(`getTranslations({ locale })`). 이러면 next-intl이 요청 헤더를 읽지 않아 `setRequestLocale`도 필요 없고, `/ko`·`/en`이 빌드 때 정적으로 생성됩니다. 자체 `t()`로 바꿀 일은 없었습니다. next-intl 미들웨어·내비게이션 API는 쓰지 않았습니다.

### 5단계 — 랜딩 섹션과 변수

- 헤더(로고·내비·언어 전환) → 히어로 → 기능 6 → 요금제 3 → CTA → 푸터.
- 가격: ko는 `price_krw`를 KRW(₩8,000), en은 `price_usd`를 USD($6). 0이면 `pricing.free`.
- `signup_url`은 `GET /variables`에서. 체험 일수·이메일은 번역·콘텐츠 안에서 치환돼 오므로 앱이 변수를 직접 읽지 않습니다.
- 기획서와 다르게 한 것: 언어 전환은 링크 두 개가 아니라 **반대 언어로 가는 링크 하나**. 번역 키 `lang.switch`의 값이 "상대 언어 이름"(ko 화면에 "English")으로 들어 있어 그대로 썼습니다.
- 기획서의 "요금제 배지에 체험 일수"는 넣지 않았습니다. 해당 번역 키가 없고, Pro summary에 이미 체험 일수가 들어 있습니다.
- `/api/revalidate`: Bearer `REVALIDATE_SECRET` 확인 후 `revalidateTag('landing', 'max')`.
- **변수·번역 변경 → 재검증 확인 (이름 변경 때).** 변수 `contact_email`과 번역 `cta.title`·`footer.copyright`를 MCP로 바꾼 뒤: 재검증 전에는 두 언어 모두 옛 값 → `POST /api/revalidate` → **바로 다음 요청은 아직 옛 값**(stale-while-revalidate로 캐시된 페이지를 먼저 주고 뒤에서 다시 만듦) → 그다음 요청부터 `/ko`·`/en` 모두 새 값. 코드 배포는 없었습니다.
- TODO: 기획서의 `free_trial_days` 14→30 장면(캡처 4)은 녹화와 함께 사람이 진행. 끝나면 14로 원복.

### 6단계 — 검증 (2026-11-18, 로컬 `next start`)

| 확인 | 결과 |
| --- | --- |
| `pnpm lint`, `pnpm typecheck`, `pnpm build` (실제 환경변수) | 통과. `/ko`·`/en` 정적 생성 |
| `/i18n-landing` | 307 → `/i18n-landing/ko` |
| `Accept-Language: en-US` | 307 → `/i18n-landing/en` |
| 쿠키 `NEXT_LOCALE=en` + `Accept-Language: ko` | 307 → `/en` (쿠키 우선) |
| `/i18n-landing/ja` | 404 |
| 화면에 키 이름(`hero.title` 등)·`{{` 남음 | 0건 (두 언어) |
| 영어 값이 빈 `pricing.popular` | `/en`에서 한국어 "가장 인기"로 표시 (폴백) |
| `hreflang` | `canonical` + `alternate` ko, en |
| `/api/revalidate` | 시크릿 없으면 401, 있으면 200 |
| `.next/static`에 `pk-proj_`, `api.onttle.com`, 프로젝트 ID | 각 0건 |
| `onttle.ts` 밖의 `fetch(` | 0건 |
| 브라우저 네트워크의 Onttle 요청 | 0건 |

### 7단계 — 배포·문서

- `_gateway/vercel.json` rewrite 2줄, `_gateway/public/index.html` 목록, `_gateway/README.md` 표, 루트 README 표, `i18n-landing/README.md`, `.env.example` 작성.
- Vercel 프로젝트 `onttle-examples-i18n-landing` 생성 (Vercel MCP): Root Directory `i18n-landing`, 저장소 연결, 환경변수 7개(Production·Preview, 키와 `REVALIDATE_SECRET`은 Sensitive). 새 프로젝트의 Deployment Protection 기본값이 `all_except_custom_domains`라 `*.vercel.app` 주소까지 막혀 게이트웨이가 프록시할 수 없음 → help-center와 같은 `prod_deployment_urls_and_all_previews`로 바꿈.
- PR 브랜치로 첫 배포. 프로젝트의 첫 배포라 Production으로 올라감. `onttle-examples-i18n-landing.vercel.app/i18n-landing`에서 확인: `/` → 307 `/i18n-landing/ko`(`Location`이 상대 경로), `Accept-Language: en` → `/en`, `/ja` → 404, `/ko`는 `x-vercel-cache: PRERENDER`, `hreflang`은 `example.onttle.com` 기준, 재검증 200.
- TODO: PR 머지 뒤 게이트웨이를 거친 `https://example.onttle.com/i18n-landing/ko`·`/en` 확인.
- TODO: 캡처 6개 (`docs/assets/01~06`).
- TODO: #onttle-content에 완료 알림.

## 3. 에이전트가 틀린 곳, 막힌 점

1. **이미 있는 샘플을 또 넣으려 했음.** 첫 `onttle_get_project`에서 콘텐츠가 0건이라, Claude가 features 6건·plans 3건을 직접 써서 `onttle_create_contents` 미리보기까지 받았습니다. 사람이 "이미 넣은 것 같아요"라고 답해 다시 조회하니 6건·3건이 들어와 있었습니다 (커넥터 작업이 그 사이에 채움). MCP 쓰기가 미리보기 → 확인 2단계라서 중복 9건이 생기지 않았습니다.
2. **기획서의 가정 중 실제와 달랐던 것**: 번역 필드 이름(`values` → `value`), 번역 수(25 → 16), 기본 언어(ko → en), `?locale=`로 다국어 컬럼 모양이 바뀐다는 가정(바뀌지 않음), `GET /variables/{key}`(404).
3. **문서 예시 두 개가 다 틀린 경우.** 변수 문서의 목록 예시는 `{ list, pagination }`인데 실제는 배열입니다. 번역은 문서 안에서 배열과 `{ list }`가 섞여 있고 실제는 배열입니다. 타입은 실제 응답으로 잡았습니다.
4. **가상 서비스 이름 변경.** 기획서는 help-center와 같은 "노트포지(NoteForge)"였는데, 로컬 검증까지 끝난 뒤 사람이 다른 이름을 쓰기로 해 "페이지웍스(Pageworks)"로 바꿨습니다. 앱에서 이름이 하드코딩된 곳은 로고·`<title>`·폴백 JSON 3곳뿐이었고, 나머지(번역 `cta.title`·`footer.copyright`, 변수 `contact_email`)는 Onttle에서 고쳤습니다 — 이름이 번역과 변수에 있으면 코드 배포 없이 바뀐다는 이 예제의 요지 그대로입니다.
5. **다시 빌드해도 옛 데이터가 나옴.** Onttle 값을 바꾼 직후 `pnpm build`를 다시 했는데 `/ko`·`/en`이 옛 이름으로 생성됐습니다. `'use cache'` 결과가 이전 빌드의 캐시(`.next/cache`)에서 재사용된 것으로 보입니다 (원인은 추정, 5분 안에 다시 빌드한 경우). 서버를 띄운 뒤 `/api/revalidate`를 한 번 부르자 새 값으로 바뀌었습니다. 배포 직후에도 값이 옛것이면 재검증을 한 번 호출하면 됩니다.
6. 막혀서 멈춘 곳은 없습니다. next-intl + Cache Components 조합은 첫 빌드에서 통과했습니다.

## 4. 글에서 쓸 숫자

| 항목 | 값 |
| --- | --- |
| 번역 키 | 16개 |
| 영어 누락 키 | 1개 (`pricing.popular`) |
| 변수 | 3개 |
| 콘텐츠 | features 6건, plans 3건 |
| Onttle 호출 수 (빌드 1회, 언어 2개) | 4번 (번역·변수·features·plans, 모두 캐시 공유) |
| 대시보드 AI 번역·샘플 생성 토큰 | TODO (커넥터 작업이 샘플을 어떻게 넣었는지 확인) |
| 변수 변경 → 화면 반영 | 재검증 호출 후 두 번째 요청부터 (첫 요청은 옛 페이지). 호출하지 않으면 최대 5분 |
| 사람이 답한 질문 | 4개 (샘플 콘텐츠, 게시용 키, 새 이름, 변경 범위) |
| 실제 걸린 시간 | TODO |

# BUILD_LOG — help-center

글감용 기록입니다. 숫자와 장면은 실제로 일어난 것만 적습니다. `TODO`는 아직 채우지 못한 칸입니다.

## 요약

| 항목 | 내용 |
| --- | --- |
| 시작 | 2026-11-18 (KST) |
| 종료 | TODO |
| 만든 도구 | Claude Code (데스크톱 앱) + Onttle MCP 서버(계정 연결) |
| Onttle 프로젝트 | Onttle Examples 워크스페이스 · `002-help-center` (ko) |
| Next.js | 16.4.6 (blog와 같은 버전·설정. Cache Components, Partial Prefetching 켜짐) |
| 기획서 | [Onttle 예제 기획서 — help-center](https://claude.ai/artifact/1JKCqrzewqd8gEgkVyyC2v) |

## 1. Onttle 프로젝트

- 프로젝트·Agent·시크릿 키는 대시보드에서 만들었습니다 (MCP에 생성 도구 없음).
- 시작 시점(2026-11-18) MCP로 본 상태: 테이블 `faqs` 하나, 콘텐츠 0건.
- **샘플 FAQ 30건** (주제 6개 × 5건)을 Claude가 써서 MCP `onttle_create_contents`로 바로 발행(PUBLISHED). 생성형 AI 토큰(Onttle AI 샘플 생성)은 쓰지 않음. 가상 서비스 "노트포지"의 숫자(요금 0/8,000/15,000원, 환불 14일 등)를 FAQ끼리 맞춤. 검색 비교용으로 일부러 비슷한 쌍: 환불↔구독 취소, 비밀번호 분실↔로그인 잠김, 업그레이드↔다운그레이드.
  - MCP 쓰기 도구는 미리보기 → 사람 확인 → `confirm_token`으로 적용하는 2단계. 토큰 유효시간이 10분이라, 사람 확인을 기다리는 사이 한 번 만료돼 미리보기를 다시 받았음.
- Vector 동기화: 사람이 대시보드에서 실행 (MCP에 동기화 도구 없음). MCP `onttle_search_contents`의 stage 필터로 PENDING·OUTDATED 0건 확인. 임베딩 토큰 사용량은 TODO (대시보드 사용량).
- 시크릿 키 1개(`Onttle Help Center Secret Key`) 확인. Agent는 MCP로 조회할 수 없어 확인하지 못했습니다.

### 예상 테이블 vs 실제 테이블

| | 기획서의 예상 | 실제 (AI 설계 직후) |
| --- | --- | --- |
| faqs | question(TEXT, 필수), answer(TEXT 마크다운 또는 EDITOR), topic(CATEGORY), keywords(TEXT multiple), order(NUMBER) | **예상과 같음.** answer는 EDITOR가 아니라 TEXT(textarea, 설명 "마크다운 형식의 답변"). slug 옵션 켜짐 |
| topic | 테이블이 아니라 카테고리 | **카테고리로 나옴** (`topic`, 값 6개: account, billing, plans, collaboration, integrations, security) |
| 테이블 slug | 예상 안 함 | **비어 있음** → API 경로에 `faqs`를 쓸 수 없고 테이블 ID를 써야 함 (아래 2) |

- 권한 규칙: read `public`, create/update/delete `none`. Embeddings·BM25 엔드포인트 켜짐.
- 스키마는 손대지 않았습니다 (blog에서 중복 컬럼 사고가 있었음).

## 2. 단계별 기록

### 1단계 — 규칙·명세 읽기

환경변수 확인: 첫 실행 때 프로젝트가 없어 멈췄고, 사람이 대시보드 작업을 마친 뒤 재개. 재개 시점에도 이 셸에는 `ONTTLE_*` 환경변수가 없어 실제 API 호출은 하지 못했습니다. 명세는 MCP(`onttle_get_openapi_spec`, `onttle_get_api_reference`, `onttle_search_docs`)로 읽었습니다.

| 쓸 것 | 경로 / 형식 | 출처 |
| --- | --- | --- |
| 목록 | `GET /tables/{table}?page&size&sort` · size 최대 1000 · `{ list, pagination }` | OpenAPI |
| 단건 | `GET /tables/{table}/{id}` · `{id}`는 content id 또는 slug | OpenAPI, blog에서 slug 동작 확인 |
| 의미 검색 | `POST /tables/{table}/embeddings` `{ query, threshold(0.7), count(5, 최대 100) }` → `{ list: [...item, score] }` | OpenAPI |
| 카테고리 | `GET /categories` → 배열 `[{ id, name, description, categories_values: [{ id, name }] }]`, 값은 저장 순서 | 카테고리 문서 |
| 새 대화 | `POST /chats` `{ agent_id, message, tableIds, search_type, threshold, count, is_plain }` → **text/plain 스트림, 이어 붙이면 JSON** `{ chatId, message, contents: [{ id, table_id }] }` | OpenAPI + Chats 문서 |
| 이어가기 | `POST /chats/{chatId}/messages` (본문 같음) → `{ chatMessageId, message, contents }` | Chats 문서 |
| 이력 | `GET /chats/{chatId}/messages?lastId=` → `{ data: [{ id, agent_id, message, chat_messages_contents_connections: [{ order, score, contents: { id, slug, title, data, table_id } }] }] }`, 오래된 순 최대 20개 | Chats 문서 |

**문서·명세가 어긋난 곳**

1. **테이블 경로의 ID가 세 가지.** OpenAPI 명세 경로는 `/tables/<UUID>`, `onttle_get_api_reference`는 `/tables/<id_nano>`(21자), 문서 예시는 `/tables/posts`(slug)인데 이 테이블은 slug가 비어 있음. 앱은 `ONTTLE_FAQ_TABLE_ID` 하나를 경로와 Chats `tableIds`에 같이 씁니다. **id_nano(21자)로 목록 경로가 동작함을 실제 빌드로 확인** (2026-11-18). → TODO: Chats `tableIds`도 id_nano로 동작하는지 (Chats 이력의 `contents.table_id` 값과 비교)
2. **항목 모양.** OpenAPI `TableItem_*`은 컬럼이 최상위(`question`, `topic: uuid`), MCP TypeScript `FaqsResponse`는 `data.question`, `data.topic: { id, name }`. **실제 응답은 TypeScript 쪽**: `{ id, slug, created_at, updated_at, published_at, data: { question, answer, topic: { id, name }, keywords, order } }` (2026-11-18 확인). OpenAPI 스키마가 틀림.
3. **sort.** OpenAPI 설명은 `name:asc`, API 레퍼런스는 JSON 배열 `[{ i, o }]`. 실제로는 JSON 배열이 `created_at` 같은 기본 필드에만 먹고, 사용자 컬럼(`order`, `question`)은 asc/desc 모두 **무시**(기본 정렬 그대로). `i`에 컬럼 UUID를 넣으면 **500**. `name:asc` 형식도 무시. → 앱은 전부 받아 서버에서 `order`로 정렬.
7. **size.** 명세는 최대 1000이지만 실제로 10·50은 그대로, 5·100·1000은 **조용히 50**으로 바뀜 (`pagination.size`가 50으로 옴). 처음 코드(`size=1000`, `list.length < size`면 중단)는 FAQ가 50건을 넘으면 51번째부터 빠뜨림 → 50씩 `pagination.totalPages`까지 돌도록 수정. blog의 `listAllPosts`(`size=100`)도 같은 문제가 있음.
4. **카테고리·이력 응답 스키마.** OpenAPI는 둘 다 `additionalProperties: true`(모양 없음). 문서 예시 기준으로 타입을 잡았습니다.
5. **인증 헤더.** API 레퍼런스는 `X-Onttle-Key`를 안내하고 `Authorization: Bearer`도 받는다고 함. Chats 문서 예시는 Bearer. blog와 같이 Bearer를 씁니다.
6. **Chats 참조 콘텐츠 (실측).** 문서 예시와 다른 점:
   - 스트림의 `contents[].id`가 content UUID가 아니라 **slug**(`refund-policy`). `table_id`는 id_nano(21자)이고 `ONTTLE_FAQ_TABLE_ID`와 같음 → `tableIds`에 id_nano가 동작함을 확인.
   - 새 대화 스트림에도 `chatMessageId`가 옴 (문서는 이어가기에만 표시).
   - 이력 `chat_messages_contents_connections[].contents`는 `{ id, table_id }`뿐. 문서의 `slug`·`title`·`data`·`icon` 없음. 메시지에 `role`, `contents` 필드가 더 있음.
   - `score`가 **문자열**(`"0.5256…"`). 클라이언트가 `toFixed()`를 부르면 브라우저에서 터짐 → 서버에서 `Number()`.
   - 이력 connections는 검색 후보 전체(`count`만큼, 관계없는 FAQ 포함), 스트림 `contents`는 답변이 참조한 것(1~2건). 처음엔 connections를 출처로 써서 "동시 편집" 같은 무관한 FAQ가 출처로 나옴 → 출처는 스트림 `contents`, 점수만 connections에서. 질문·slug는 캐시된 FAQ 목록에서 찾음.
   - **같은 FAQ인데 ID 형식이 다름**: 스트림 `contents[].id`는 slug(`education-discount`), 이력 connections의 `contents.id`는 content UUID. slug로 점수를 찾아서 점수가 항상 `null`이었음 → 양쪽 모두 FAQ 레코드로 바꾼 뒤 맞춤.
   - **이어가기 스트림의 `contents[].id`는 식별자가 아닐 때가 있음**: "비영리 단체는요?" → `plans` 카테고리 값 UUID, "팀원 초대는 어떻게 해요?" → `"41"`(invite-members의 `order` 값). 모델이 참조 목록을 직접 쓰면서 콘텐츠의 아무 필드나 고르는 것으로 보임. 이력 connections의 UUID·점수는 정확함 → 스트림 `contents`가 FAQ로 하나도 안 풀리면 이력의 최고 점수 후보 하나를 출처로. 수정 후 새 대화·이어가기 2회·근거 없음 4건 모두 출처 정상. Onttle에 보고할 만한 문제.

### 2단계 — 뼈대와 API 모듈

- `create-next-app` 대신 blog의 설정 파일(`package.json`, `tsconfig`, eslint, `.gitignore`, `pnpm-lock.yaml`)을 복사해 같은 버전으로 맞춤.
- `src/lib/onttle.ts`: `listFaqs`, `getFaq`, `listTopics`(기획서의 `listCategories`), `searchFaqs`, `startChat`, `sendMessage`, `getMessages`. 맨 위 `import "server-only"`.
- `ONTTLE_API_URL`: 기획서는 `https://api.onttle.com/v1`, blog `.env.example`은 `https://api.onttle.com`. 둘 다 받도록 끝의 `/v1`을 떼고 붙임.
- 클라이언트 `fetch`에는 basePath가 붙지 않음 → `src/lib/base-path.ts` 한 값을 `next.config.ts`와 채팅 컴포넌트가 함께 씀.

### 3단계 — FAQ 목록·상세

- 홈: `listFaqs`(order 오름차순, 1000건씩 끝까지)와 `listTopics`를 같이 캐시(`faqs` 태그, 5분). 카테고리 저장 순서대로 `<details>` 아코디언, 주제 없는 FAQ는 맨 뒤 "기타".
- 상세: `generateStaticParams`가 FAQ 0건이면 자리표시 `_` 반환 (blog에서 겪은 Cache Components 빌드 실패 대응을 처음부터 적용).
- 없는 slug: 404 화면은 나오지만 상태 코드 200 (blog와 같은 스트리밍 한계).

### 4단계 — 의미 검색

- 서버 컴포넌트에서 Embeddings 호출, 캐시하지 않음. 결과는 현재 발행 목록과 교차 확인.
- threshold는 명세 기본 0.7 대신 0.5로 시작 (기획서 위험 "한글 검색 품질"). → TODO: 질문 10개로 값 정하기
- 결과가 없거나 원하는 답이 없으면 `/ask?q=<검색어>`로 안내 (질문이 미리 채워짐).
- TODO: FAQ에 없는 단어로 물어도 뜻이 비슷한 FAQ가 나오는 예 1개

### 5단계 — AI 대화

`POST /api/ask` 흐름:

1. 길이 확인 (`ASK_MAX_MESSAGE_LENGTH`, 기본 300) → 400 `too_long`.
2. `chatId`가 있으면 `GET /chats/{chatId}/messages`로 이력을 읽어 AI 답변 수를 셈 → `ASK_MAX_TURNS`(기본 6) 이상이면 429 `turn_limit`. 이력의 마지막 id를 기억.
3. `startChat` / `sendMessage` → 스트림을 끝까지 읽어 `JSON.parse`.
4. `GET /chats/{chatId}/messages?lastId=<2의 마지막 id>`로 방금 답변의 참조 콘텐츠를 받아 출처(slug, 질문, 점수)를 만듦. 이 단계가 실패해도 답변은 돌려줌.

설계 메모:

- 횟수 제한을 브라우저가 보내는 값이 아니라 **Onttle 이력으로 셈** → 우회 불가. 이력 GET이 최대 20개라 `ASK_MAX_TURNS`는 9로 상한.
- 새 대화 응답에는 `chatId`, 이어가기 응답에는 `chatMessageId`가 온다는 문서 차이를 타입에 반영 (`ChatReply`).
- 오류: 401·403은 "설정 문제", 그 외는 일반 안내. 원문은 서버 로그에 상태 코드와 경로만.

### 6단계 — 검증 (2026-11-18)

실제 키가 이 환경에 없어, 문서의 응답 모양을 흉내 낸 **로컬 목 API**(스트림을 7바이트씩 쪼개 보냄)로 확인했습니다.

| 확인 | 결과 |
| --- | --- |
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | 통과 (목 API 연결) |
| 새 대화 → 출처 카드 | `chatId`, 답변, 출처 `refund-period` (점수 0.91), `turnsLeft` |
| 이어가기 | 같은 `chatId`로 문맥 유지, `lastId`로 새 답변의 출처만 |
| `ASK_MAX_TURNS=2`에서 세 번째 질문 | 429 `turn_limit` |
| 301자 질문 / 잘못된 chatId | 400 `too_long` / 400 `bad_request` |
| `/api/revalidate` | Bearer 맞으면 200, 없으면 401 |
| 브라우저 네트워크 | `/help-center/api/ask`만 호출, Onttle 요청 없음. 출처 링크 `/help-center/faq/…` |
| 빌드 결과물 `.next/static` | `sk-proj_`, `api.onttle.com` 없음 |

실제 프로젝트 연결(`.env.local`): `pnpm lint`, `pnpm typecheck`, `pnpm build` 통과. FAQ 0건이라 목록은 비고 상세는 자리표시 `_`만 생성. `GET /tables/{id_nano}`, `GET /categories` 응답 정상. 빌드 결과물에 `sk-proj_` 없음.
샘플 30건 발행 후 재빌드: FAQ 상세 30개 정적 생성, 홈 주제 순서(계정·결제·요금제·협업·연동·보안)가 카테고리 저장 순서와 같음, 답변 안 마크다운 표·상대 링크(`refund-policy`) 정상.
Vector 동기화 후 실제 검색·AI 대화 확인 (2026-11-18): 아래 4절 표. 브라우저 화면에서 답변 + 출처 카드 2개, 콘솔 에러 없음, 브라우저에서 Onttle 요청 없음.

### 7단계 — 배포·문서

- `_gateway/vercel.json` rewrite 2줄, `_gateway/public/index.html`, `_gateway/README.md`, 루트 README 표에 추가.
- Vercel 프로젝트 `onttle-examples-help-center` (2026-11-18): CLI `vercel project add` → MCP `update_project`로 Root Directory `help-center`, Framework Next.js → `vercel link` + `vercel git connect`(GitHub 저장소 연결).
  - 새 프로젝트의 기본 Deployment Protection이 `all_except_custom_domains`라 `*.vercel.app` 프로덕션 주소까지 Vercel 로그인이 걸림 → 게이트웨이 프록시가 막힘. blog와 같은 `prod_deployment_urls_and_all_previews`로 바꿈.
  - 환경변수 9개를 production·preview에 등록 (`.env.local`에서 CLI로 바로 넘겨 값은 출력하지 않음). `NEXT_PUBLIC_SITE_URL`은 `https://example.onttle.com/help-center`. 팀 정책으로 일반 값도 sensitive/encrypted로 저장됨.
  - `vercel deploy --prod`로 PR 브랜치 코드를 프로덕션 배포 → `onttle-examples-help-center.vercel.app/help-center`에서 목록·상세·검색·AI 대화·재검증(401) 확인.
  - 그 배포에서 AI 대화의 출처 점수가 계속 `null` (출처 자체는 맞음). 처음엔 이력 저장 타이밍을 의심했으나, 스트림 직후·1초·3초 뒤 이력이 모두 같아 **타이밍 문제가 아님**. 원인은 아래 2단계 6번의 ID 형식 차이 (내 버그). 로컬 화면 확인 때도 점수가 빠져 있었는데 놓쳤음.
  - `example.onttle.com/help-center`는 게이트웨이 rewrite가 PR에만 있어 머지 전까지 404.

## 3. 막힌 점과 우회

| 문제 | 우회 |
| --- | --- |
| MCP로 프로젝트·Agent·시크릿 키를 만들 수 없음 | 대시보드에서 생성 |
| 테이블 slug가 비어 경로에 `faqs`를 못 씀, 명세와 레퍼런스의 테이블 ID가 다름 | `ONTTLE_FAQ_TABLE_ID` 환경변수 (TODO: 실제 확인) |
| Chats 첫 응답의 `contents`에 slug·제목이 없음 | 메시지 이력 GET(`lastId`)으로 보강 |
| 목록 `size`가 50으로 바뀌고 사용자 컬럼 sort가 무시됨 | 50씩 `totalPages`까지 받고 서버에서 정렬 |
| Chats 기본 threshold 0.7에서 구어체 질문이 근거를 못 찾음 ("환불 관련 정보를 찾지 못해…") | `threshold: 0.3` (날씨 질문은 여전히 모른다고 답함) |
| 스트림의 chatId가 한 번 34자로 잘려 옴 → 이어가기·이력 GET 모두 500 | 직접 3번 다시 불렀을 때는 재현 안 됨. UUID 형식이 아니면 답변만 주고 `chatId: null` → 다음 질문은 새 대화. 서버 로그에 길이만 남김 |
| AI 답변의 `**"나간 멤버"**`가 굵게 안 되고 별표가 보임 | CommonMark 강조 규칙이 한글 바로 앞뒤의 따옴표에서 깨지는 문제. 미해결 (remark CJK 플러그인 검토) |
| 첫 재개 때 셸에 실제 키가 없음 | 목 API로 흐름 검증 → 이후 `.env.local`로 실제 빌드 |

## 4. 글에서 쓸 숫자 (TODO)

- 샘플 FAQ 건수: 30 (주제 6 × 5). Vector 동기화에 쓴 임베딩 토큰: TODO
- **의미 검색 실측** (Embeddings, threshold 0, count 3):

  | 질문 | 정답 FAQ | 정답 순위 | 1위 (점수) | 정답 점수 |
  | --- | --- | --- | --- | --- |
  | 환불은 언제까지 되나요? (원문 그대로) | refund-policy | 1 | refund-policy (1.000) | 1.000 |
  | 학생 할인 | education-discount | 1 | education-discount (0.737) | 0.737 |
  | 회사 옥타 계정으로 로그인 | sso | 1 | sso (0.700) | 0.700 |
  | 팀원 내보내면 메모 사라지나 | remove-member | 2 | share-note-link (0.576) | 0.556 |
  | 자동결제 끊는 법 | cancel-subscription | 2 | refund-policy (0.418) | 0.375 |
  | 비번 까먹음 | reset-password | 2 | export-notes (0.309) | 0.299 |
  | 돈 돌려받고 싶어요 | refund-policy | 3 | change-card (0.427) | 0.392 |
  | 노션에 있던 거 옮기기 | import-notes | 3 | sign-up (0.302) | 0.300 |
  | 오늘 날씨 어때 (근거 없음) | - | - | simultaneous-editing (0.318) | - |
  | 파스타 레시피 (근거 없음) | - | - | simultaneous-editing (0.284) | - |

  1위 정답 4/8, 3위 안 8/8. 구어체·줄임말은 정답도 0.3~0.4로 잡음(0.28~0.32)과 안 갈림. 검색 화면 threshold는 0.5 → **0.35**로 (잡음은 숨기고 결과 없으면 AI로 안내).
- **AI 대화 실측** (hybrid, count 5): threshold 0.7(기본) → 환불 질문에 "정보를 찾지 못해…", 출처 0. threshold 0.3 → "결제한 지 일주일이면 14일 이내라 전액 환불 대상입니다…", 출처 refund-policy. 이어가기("연간 결제였으면 한 달 지나도 돼요?") → 남은 개월 비례 환불로 문맥 유지. "오늘 서울 날씨" → 0.7·0.3 모두 모른다고 답함. 응답 시간 5~13초.
- 질문 10개 × search_type 4가지 출처 정답 수 (`ASK_SEARCH_TYPE`으로 바꿔 가며):

  | search_type | 맞음 | 틀림 |
  | --- | --- | --- |
  | vector | | |
  | query | | |
  | hybrid | | |
  | bm25 | | |

- 근거 없는 질문("날씨 어때")에 Agent가 모른다고 답했는지: 예 (3회 모두)
- 답변 하나당 대략의 토큰, 데모 호출 제한 값 (현재 300자 · 6턴):
- 에이전트가 틀린 횟수와 내용 / 사람이 직접 고친 곳:
- 실제 걸린 시간:

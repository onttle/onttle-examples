# Onttle로 만드는 AI 헬프센터 (help-center)

FAQ를 Onttle에 넣고, 방문자가 질문하면 Onttle Agent가 FAQ를 근거로 답하고 출처를 보여주는 Next.js 헬프센터 예제입니다. RAG 파이프라인이나 벡터 DB를 직접 만들지 않고, FAQ 테이블 하나와 Agent 설정, Route Handler 하나로 만듭니다.

"노트포지"는 예제용 가상 서비스입니다. 답변이 실제 안내로 오해되지 않도록 실제 회사 문서를 쓰지 않았습니다.

- 데모: https://example.onttle.com/help-center
- 기획서: [Onttle 예제 기획서 — help-center](https://claude.ai/artifact/1JKCqrzewqd8gEgkVyyC2v)
- 만든 기록: [docs/BUILD_LOG.md](docs/BUILD_LOG.md)

## 화면

경로는 모두 `basePath` `/help-center` 아래입니다 (로컬: `http://localhost:3000/help-center`).

| 경로 | 내용 | 렌더링 |
| --- | --- | --- |
| `/` | 주제별 FAQ 목록 (아코디언) | 정적 셸 + 캐시된 데이터 (5분, `faqs` 태그) |
| `/faq/[slug]` | FAQ 상세 (마크다운 답변) | 빌드 때 생성, 새 FAQ는 첫 요청 때 생성 후 캐시 |
| `/search?q=` | 의미 검색 (Embeddings) | 요청마다 |
| `/ask` | AI 대화 + 출처 카드 | 정적 셸 + 클라이언트 상태 (`/api/ask`만 호출) |
| `POST /api/ask` | Chats 호출, 길이·횟수 제한 | 동적 |
| `POST /api/revalidate` | `faqs` 캐시 즉시 무효화 | 동적 |

## 사용한 Onttle 기능

| 기능 | 엔드포인트 | 쓰는 곳 |
| --- | --- | --- |
| Chats (Agent + `search_type`) | `POST /chats`, `POST /chats/{chatId}/messages` (threshold 0.3) | AI 대화 |
| Chats 메시지 이력 | `GET /chats/{chatId}/messages?lastId=` | 출처 점수, 대화 횟수 확인 |
| Agents | 대시보드에서 생성, `agent_id`로 지정 | 답변 지침·모델·Max Tokens |
| Embeddings 의미 검색 | `POST /tables/{faqs}/embeddings` (threshold 0.35) | 검색 |
| Vector 동기화 | 대시보드 | 검색·AI 답변의 근거 |
| 카테고리 API | `GET /categories` | 주제 순서 |
| 콘텐츠 API | `GET /tables/{faqs}`, `GET /tables/{faqs}/{slug}` | 목록·상세 |

API 호출은 모두 [`src/lib/onttle.ts`](src/lib/onttle.ts) 한 파일에 있고, `server-only`로 브라우저 번들에 들어가지 않게 막았습니다. Chats와 Embeddings는 POST라 **시크릿 키**가 필요해서, 브라우저는 앱의 `/api/ask`만 부릅니다.

Chats 응답은 `text/plain` 스트림이고, 조각을 전부 이어 붙여야 JSON 하나(`chatId`, `message`, `contents`)가 됩니다. SSE도 아니고 `res.json()`으로도 읽을 수 없습니다. 이 예제는 서버에서 끝까지 읽어 파싱한 뒤 JSON으로 돌려줍니다. `contents`에는 `{ id, table_id }`만 있어서, 출처 카드에 쓸 slug와 질문은 메시지 이력 GET으로 받습니다.

## Onttle 프로젝트 준비

1. 프로젝트를 만들고 `faqs` 테이블을 둡니다 (slug 지원).

   | 컬럼 | 타입 | 비고 |
   | --- | --- | --- |
   | `question` | TEXT | 필수 |
   | `answer` | TEXT (textarea) | 마크다운 |
   | `topic` | CATEGORY (`topic`) | account, billing, plans, collaboration, integrations, security |
   | `keywords` | TEXT (multiple) | |
   | `order` | NUMBER | 목록 순서 |

2. FAQ를 넣고 **발행**합니다.
3. **Vector** 메뉴에서 `faqs`를 동기화하고 상태가 SUCCESS인지 확인합니다. 동기화는 발행된 콘텐츠만 대상입니다.
4. **Agents** 메뉴에서 Agent를 만듭니다. 이 예제의 Instructions: "노트포지 헬프센터 안내 도우미입니다. 제공된 FAQ에 근거해서만 답합니다. 근거가 없으면 모른다고 답하고 FAQ 목록을 안내합니다. 존댓말로 3~5문장." Max Tokens는 500 정도로 짧게 둡니다.
5. **API 엔드포인트 → 사전 정의 API**에서 카테고리 API를 켜고, 시크릿 키를 발급합니다.

> **FAQ를 고치면 Vector를 다시 동기화하세요.** 목록·상세는 `/api/revalidate`로 바로 바뀌지만, 검색과 AI 답변은 마지막 동기화 시점의 내용을 씁니다.

## 실행

```bash
cp .env.example .env.local   # 값 채우기
pnpm install
pnpm dev
```

| 환경변수 | 설명 |
| --- | --- |
| `ONTTLE_API_URL` | `https://api.onttle.com` (`/v1`을 붙여도 됨) |
| `ONTTLE_PROJECT_ID` | 프로젝트 설정의 Project ID |
| `ONTTLE_API_KEY` | 시크릿 키 `sk-proj_…` (서버 전용, `NEXT_PUBLIC_` 금지) |
| `ONTTLE_AGENT_ID` | Agents 메뉴의 Agent ID |
| `ONTTLE_FAQ_TABLE_ID` | `faqs` 테이블 ID. 테이블 slug가 없어 경로(`/tables/{id}`)와 Chats `tableIds`에 함께 씁니다 |
| `ASK_MAX_MESSAGE_LENGTH` | 질문 최대 글자 수 (기본 300) |
| `ASK_MAX_TURNS` | 대화당 최대 질문 수 (기본 6, 최대 9) |
| `ASK_SEARCH_TYPE` | `vector` · `query` · `hybrid` · `bm25` (기본 `hybrid`) |
| `REVALIDATE_SECRET` | `/api/revalidate` 보호용 임의 문자열 |
| `NEXT_PUBLIC_SITE_URL` | 절대 URL, basePath 포함 (`https://example.onttle.com/help-center`) |

```bash
pnpm lint && pnpm typecheck && pnpm build
```

### 즉시 반영

```bash
curl -X POST https://example.onttle.com/help-center/api/revalidate -H "Authorization: Bearer $REVALIDATE_SECRET"
```

## 공개 데모의 AI 비용

질문마다 AI 토큰(`AI_ASK_TOKENS`), 검색마다 임베딩 토큰(`API_EMBEDDINGS_TOKENS`)이 듭니다. 이 예제는 다음으로 비용을 제한합니다.

- Agent의 Max Tokens를 짧게
- 질문 길이(`ASK_MAX_MESSAGE_LENGTH`)와 대화당 횟수(`ASK_MAX_TURNS`)를 서버에서 확인. 횟수는 Onttle의 대화 이력으로 세기 때문에 브라우저가 우회할 수 없습니다.
- IP별 호출 제한은 넣지 않았습니다. 필요하면 Vercel Firewall rate limit 같은 앞단에서 거세요.

## 배포 (Vercel)

- 프로젝트 `onttle-examples-help-center`, Root Directory `help-center`. 위 환경변수는 Vercel에만 저장합니다.
- `basePath: "/help-center"`. 링크는 `next/link`, 폼은 `next/form`을 써야 basePath가 붙습니다. 클라이언트 `fetch`에는 basePath가 붙지 않으므로 [`src/lib/base-path.ts`](src/lib/base-path.ts)의 값을 붙여 부릅니다.
- 공개 도메인 `example.onttle.com`은 [`_gateway`](../_gateway) 프로젝트가 갖고, `/help-center/*`를 `onttle-examples-help-center.vercel.app/help-center/*`로 프록시합니다.

## 이번에 하지 않은 것

글자 단위 스트리밍 표시, 대화 저장·새로고침 후 복원, 회원 로그인, 다국어, "도움이 됐나요" 피드백, Onttle 자체 문서를 넣은 버전, CAPTCHA.

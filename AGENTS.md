# AGENTS.md — onttle-examples 저장소 규칙

AI 코딩 에이전트와 사람 모두 이 규칙을 따릅니다.

## 구조

- `<name>/` (저장소 루트 바로 아래): 예제 하나 = 독립된 Next.js 앱 (App Router, TypeScript, Tailwind, `src/`). 예제끼리 코드를 공유하지 않습니다.
- `<name>/docs/BUILD_LOG.md`: 만든 기록 (단계별 프롬프트, 에이전트가 틀린 점, 막힌 점).
- `<name>/docs/POST.md`: 이 예제로 쓴 글. front matter `status: draft | published`.
- `<name>/docs/assets/`: 캡처·GIF.

## Onttle API

- 경로와 필드는 **그 예제 프로젝트의 OpenAPI 명세**를 기준으로 합니다. 명세에 없는 필드·파라미터를 추측하지 않습니다. 문서와 명세가 다르면 BUILD_LOG에 적습니다.
- 호출은 `src/lib/onttle.ts` 한곳에 모으고 `import "server-only"`를 둡니다.
- 시크릿 키(`sk-proj_…`)는 서버에서만 씁니다. `NEXT_PUBLIC_` 접두사에 키를 넣지 않습니다.

## 비밀값

- 실제 API 키·프로젝트 ID를 커밋하지 않습니다. `.env.example`에는 이름만 둡니다.

## 완료 기준

- `pnpm lint`, `pnpm typecheck`, `pnpm build` 통과
- README: 데모 링크, 사용한 Onttle 기능, 실행 방법
- BUILD_LOG 작성, `.env.example` 갱신
- Vercel 배포 시 Root Directory는 `<name>`

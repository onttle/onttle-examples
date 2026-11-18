# _gateway — example.onttle.com 라우터

`example.onttle.com` 도메인을 가진 Vercel 프로젝트입니다. 앱 코드는 없고, [`vercel.json`](vercel.json)의 rewrite로 경로마다 예제 앱(각자 별도 Vercel 프로젝트)을 프록시합니다. `/`는 [`public/index.html`](public/index.html) 목록 페이지입니다.

| 경로 | 예제 | 대상 Vercel 프로젝트 |
| --- | --- | --- |
| `/blog/*` | [blog](../blog) | `onttle-examples-blog` → `https://onttle-examples-blog.vercel.app/blog/*` |

## 새 예제 추가

1. 예제 앱 `next.config.ts`에 `basePath: "/<name>"`을 둡니다. 링크는 `next/link`, 폼은 `next/form`을 써야 basePath가 붙습니다. `NEXT_PUBLIC_SITE_URL`은 `https://example.onttle.com/<name>`.
2. Vercel 프로젝트 `onttle-examples-<name>`을 만들고 Root Directory를 `<name>`으로 둡니다.
3. 이 폴더 `vercel.json`에 rewrite 두 줄을 추가합니다.
   ```json
   { "source": "/<name>", "destination": "https://onttle-examples-<name>.vercel.app/<name>" },
   { "source": "/<name>/:path*", "destination": "https://onttle-examples-<name>.vercel.app/<name>/:path*" }
   ```
4. `public/index.html` 목록과 루트 README 표에 한 줄 추가합니다.

## Vercel 설정

- 프로젝트: `onttle-examples-gateway`, Root Directory `_gateway`, Framework Preset `Other`, 빌드 명령 없음
- 도메인: `example.onttle.com` (DNS: `CNAME example → cname.vercel-dns.com`)

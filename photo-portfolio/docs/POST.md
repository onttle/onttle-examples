---
title: "사진 12장에 alt를 손으로 쓰지 않았다: Onttle로 만드는 사진 포트폴리오"
status: draft
example: photo-portfolio
series: "🤖 AI 에이전트로 만들기"
---

<!--
초안입니다. 숫자와 장면은 docs/BUILD_LOG.md와 2026-11-25에 실제 API로 읽은 값입니다.
게시 전에 확인하거나 채울 것:
- 확인됨 (2026-11-25): 12장 모두 생성형 AI 이미지, 12장 모두 OCR을 켜고 업로드.
- 캡션: 아직 사람이 고친 캡션이 0개입니다. dawn-breakwater를 고친다면 "고친 수"와 본문을 바꿔야 합니다.
- 스크린샷: docs/assets/에 아직 없습니다 (사진 페이지의 alt 출처 표시, 검색 두 모드 비교 등).
- 걸린 시간.
-->

사진 포트폴리오를 만들었습니다. 시리즈 탭, 사진 상세, 그리고 "a rainy alley at night" 같은 문장으로 사진을 찾는 검색이 있습니다. 사진 12장의 alt 텍스트와 태그는 아무도 쓰지 않았습니다. 파일을 올릴 때 Onttle이 만든 AI 설명과 키워드가 그 자리를 채웁니다.

- 데모: https://example.onttle.com/photo-portfolio
- 코드: https://github.com/onttle/onttle-examples/tree/main/photo-portfolio

"Seo-ha Yun"은 이 예제를 위해 지어낸 사진가이고, 샘플 이미지는 생성형 AI로 만든 것입니다. 장소 이름도 특정한 곳을 가리키지 않습니다.

이번 편에서 볼 것은 두 가지입니다. AI가 쓴 설명을 alt로 그대로 써도 되는지, 그리고 5분 뒤 만료되는 이미지 URL을 Next.js 캐시와 어떻게 맞추는지입니다.

## 구성

| 무엇 | 어디에 |
| --- | --- |
| 사진 | Onttle `photos` 테이블. `image`는 FILE 컬럼 |
| alt, 태그, 사진 속 글자 | 업로드할 때 Onttle이 만든 `description_generated`, `keywords`, `text_vision` |
| 시리즈 | CATEGORY 컬럼 + `GET /categories`. 탭 순서는 대시보드 순서 |
| 문장 검색 | `POST /tables/photos/embeddings` |
| 키워드 검색 | `POST /tables/photos/bm25` (rerank 기본 켜짐) |

모든 호출은 서버에서 시크릿 키로 합니다. `photos`의 생성·수정·삭제 엔드포인트는 꺼 두었습니다. 앱은 읽기만 합니다.

## alt는 캡션 → AI 설명 → 제목 순서

사람이 쓴 `caption`이 있으면 그것을 쓰고, 없으면 AI 설명, 그것도 없으면 제목을 씁니다. 사진 페이지에는 어느 것을 썼는지 표시합니다. 사람이 캡션으로 바꿨다면 원래 AI 설명도 함께 보여 줍니다.

지금 캡션은 12장 모두 비어 있습니다. 즉 **12장 전부 AI 설명이 alt입니다.**

AI 설명은 모두 영어 한 문장입니다. 프로젝트 언어 코드는 `ko` 하나뿐인데도 그렇습니다. 몇 개를 옮기면 이렇습니다.

| 사진 | AI 설명 (`description_generated`) |
| --- | --- |
| rainy-crossing | Three silhouetted pedestrians carrying umbrellas cross a rain-soaked city street at night, with traffic, neon signs, and colorful reflections on the pavement. |
| last-bus | A hooded person sits alone in a glass-sided bus shelter on a dark, rainy night as a bus approaches along the wet, streetlit road. |
| low-tide | A small fishing boat sits on rippled tidal flats at low tide, beside a winding channel of water. Low hills line the hazy horizon beneath a pale sky. |

12장을 이미지와 하나씩 대 봤습니다. 사람 수, 날씨, 시간대, 구도는 모두 맞았습니다. 고칠 만한 곳은 세 군데였습니다.

1. **dawn-breakwater**: 방파제는 테트라포드로 덮여 있는데 "boulder-covered breakwater", 키워드는 "rocky seawall"이라고 했습니다. 이 예제에서 유일하게 사실과 다른 설명입니다.
2. **cherry-blossom**: 키워드에 "Japanese cherry blossom"이 들어 있습니다. 사진에는 나라를 알 단서가 없습니다.
3. **menu-board**: 간판이 이 사진의 주인공인데 설명은 "a weathered menu board"에서 그칩니다. 간판 글자는 생성 이미지라 원래 읽을 수 없는 한글 모양이고, 설명도 거기에는 손대지 않았습니다.

1번만 캡션으로 바꾸면 되는 수준입니다. 시각장애인 사용자가 듣는 문장으로는 12장 모두 쓸 만했습니다.

## 키워드는 태그로 쓰기엔 길다

키워드는 사진당 9–12개, 평균 11.1개, 모두 영어 소문자 구절입니다. 사진 페이지에서 태그로 보여 주고, 누르면 그 단어로 검색합니다.

"lighthouse", "low tide", "umbrellas"처럼 사진을 가리키는 키워드는 바로 태그가 됩니다. 반면 사진을 설명하지 않는 키워드도 섞여 있습니다.

- "moody atmosphere" (3장), "nature photography", "night photography", "coastal photography"
- "serene atmosphere", "tranquil atmosphere", "quiet solitude"

태그 목록으로 쓰려면 이런 분위기·장르 단어를 거르거나 사람이 골라야 합니다. 이번에는 그대로 두었습니다.

## OCR은 거의 쓸모가 없었다

`text_vision`(사진 속 글자)은 rainy-crossing 한 장에만 들어 있습니다.

```
201
CO
1.48 149
Prom
6A
```

뒤편 간판에서 읽어 낸 조각들입니다. 사진을 설명하는 데는 쓸 수 없습니다.

OCR은 12장 모두 켜고 올렸습니다. 나머지 11장은 빈 값입니다. 글자가 가장 많은 간판 사진(menu-board)도 비었는데, 생성 이미지라 간판 글자가 원래 읽을 수 없는 한글 모양이기 때문입니다. 실제 사진의 간판이었다면 결과가 달랐을 수 있습니다.

사용량 화면의 OCR 호출 수는 1건이었습니다. 12장에 켰으니 이 지표는 파일 수를 세는 것이 아니거나, 글자가 나온 경우만 세는 것으로 보입니다. 확인하지는 못했습니다.

풍경 사진 포트폴리오라면 OCR은 끄고 올려도 됩니다. 영수증이나 포스터처럼 글자가 주인공인 이미지에서 다시 볼 기능입니다.

## 이미지 URL은 5분 뒤에 만료된다

파일 응답의 `presigned_url`과 썸네일 URL은 임시 주소입니다. Onttle FAQ도 저장하지 말고 다시 요청하라고 합니다. 실제 키로 재 보니 전부 S3 서명 URL이고 `X-Amz-Expires=300`, 즉 **5분**이었습니다.

그래서 세 가지를 정했습니다.

- **`next/image`를 쓰지 않습니다.** 이미지 최적화기가 만료될 URL을 캐시합니다. Onttle 썸네일로 `<img srcset>`을 만듭니다.
- **캐시 수명을 URL에서 읽습니다.** `X-Amz-Date` + `X-Amz-Expires`로 남은 시간을 계산해, 절반(150초)에 재검증하고 만료 전(270초)에 버립니다.
- **`og:image`를 넣지 않습니다.** 링크 미리보기가 죽은 URL을 들고 있게 됩니다.

처음 계획은 사진 페이지를 빌드할 때 미리 만들어 두는 것이었습니다. 실제 키로 처음 빌드하자마자 실패했습니다.

```
A nested `use cache` with a short `expire` (under 5 minutes) is inside
an outer `use cache` that has no `cacheLife()`
```

Next.js 16의 Cache Components는 만료가 5분 미만인 캐시를 정적으로 만들지 않습니다. URL 수명이 5분이니 절반으로 잡은 캐시는 당연히 5분 미만입니다. 시리즈 목록을 캐시하는 함수가 사진 목록을 부르고 있어서 바깥 캐시에 짧은 캐시가 들어간 모양이 됐습니다.

고친 방법은 이렇습니다.

- 카테고리만 10분 캐시하고, 사진 목록은 따로 150초/270초로 캐시합니다.
- `/photos/[slug]`와 `/series/[id]`는 미리 만들지 않고, 요청 때 `<Suspense>` 안에서 그립니다.

대가가 하나 있습니다. 없는 slug로 들어오면 not-found 화면은 나오지만 상태 코드는 200입니다. 응답 스트림이 이미 시작된 뒤라 404로 바꿀 수 없습니다.

## 썸네일은 두 크기뿐이었다

실제 파일에는 썸네일이 80px과 500px 두 개 있고, 원본은 1024×1024 WebP입니다. 그래서 srcset은 `80w, 500w, 1024w` 세 단계입니다. 1배 화면에서는 그리드가 500px을 받지만, 휴대폰처럼 2배 화면에서는 그리드도 대부분 원본을 받습니다. 원본이 1024px라 손해는 작습니다. 원본이 3000px 사진이었다면 500px과 원본 사이에 프리셋이 하나 더 필요합니다.

썸네일 프리셋은 **업로드 전에** 정해야 합니다. 이미 올린 파일에는 나중에 만든 프리셋이 적용되지 않습니다.

## 문장으로 찾기: embeddings와 BM25

Vector 동기화 뒤 같은 질의 5개를 두 방식으로 보냈습니다. 상위 결과와 점수입니다.

| 질의 | Embeddings 1위 | BM25 + rerank 1위 |
| --- | --- | --- |
| a rainy alley at night | last-bus 0.78 | rainy-crossing 0.62 |
| blue sea | winter-sea 0.72 | dawn-breakwater 0.50 |
| a sign with writing on it | menu-board 0.58 | neon-window 0.85 |
| autumn leaves | autumn-leaves 0.80 | autumn-leaves 0.95 (결과 1개) |
| a street with no people | old-town-alley 0.66 | old-town-alley 0.85 |

Embeddings는 5개 중 4개에서 맞는 사진을 1위에 올렸습니다. 놓친 하나는 "a rainy alley at night"에서 버스 정류장을 비 오는 교차로 위에 둔 것입니다. 둘 다 비 오는 밤이라 틀렸다고 하기도 애매합니다.

**임계값은 0.5로 정했습니다.** 처음엔 사진이 12장뿐이라 0.3으로 낮게 잡았는데, "blue sea"가 12장 중 10장을 돌려줬습니다. 맞는 사진은 0.58–0.80, 관계없는 사진은 0.37–0.51이었습니다. 배포한 사이트에서 0.5로 다시 보니 "blue sea"는 4장, "autumn leaves"는 1장, "a rainy alley at night"는 5장입니다.

검색에는 **10초 타임아웃**도 걸었습니다. 테스트 10분쯤 뒤 Onttle 응답이 느려져 목록 19초, 검색은 40초 넘게 걸린 적이 있습니다. 타임아웃이 없으면 검색 화면이 "Searching…"에 멈춰 있습니다. 배포 직후 첫 문장 검색도 한 번 10초를 넘겼고, 바로 다음 요청부터는 1–2.5초였습니다.

공개 데모라 검색 한 번마다 토큰이 듭니다. 질의는 100자에서 자르고, 빈 질의는 호출하지 않고, `SEARCH_DISABLED=true`로 검색을 끌 수 있게 했습니다.

## 에이전트가 틀린 곳

Claude Code와 Onttle MCP로 만들었습니다. 틀린 곳은 네 군데입니다.

1. **MCP로 제목만 고쳤는데 사진이 전부 빠졌습니다.** 콘텐츠를 영어로 바꾸면서 `title`과 `location`만 보냈더니, 보내지 않은 FILE 컬럼 `image`가 12행 모두 비었습니다. 사이트는 다시 "No photos yet"이 됐습니다. MCP로 파일을 다시 연결하려 했지만 "applied"라고 답하고도 저장되지 않았습니다. 결국 각 행을 이미지가 있던 버전으로 롤백했고, 제목과 장소는 사람이 대시보드에서 다시 영어로 고쳤습니다. 부분 수정이 보내지 않은 컬럼을 지우는지 먼저 한 행으로 확인했어야 했습니다.
2. **중첩 캐시로 빌드가 깨졌습니다.** 위의 5분 이야기입니다. 가짜 API로 빌드할 때는 URL 수명을 1시간으로 두어서 통과했습니다.
3. **근거 없이 임계값을 정했습니다.** 0.3은 "12장이니 낮게"라는 짐작이었습니다. 실제 점수를 보고 0.5로 바꿨습니다.
4. **가짜 데이터가 실제와 달랐습니다.** 키가 없던 단계에서 스펙 모양의 가짜 API로 화면을 점검했는데, URL 수명(1시간 vs 실제 5분)과 썸네일 크기(960px 등 세 개 vs 실제 80/500 두 개)를 짐작으로 넣었습니다. 화면 점검은 통과했지만 실제 값에 대해서는 아무것도 알려 주지 않았습니다.

1번이 가장 비쌌습니다. MCP 쓰기 한 번으로 공개 사이트의 사진이 전부 사라졌고, 되돌리는 데 롤백 12번이 들었습니다.

## 숫자

| 항목 | 값 |
| --- | --- |
| 사진 / 시리즈 | 12장 / 4개 (City Nights, Sea, Alleys, Seasons) |
| 사람이 쓴 캡션 | 0개 (12장 모두 AI 설명이 alt) |
| AI 설명 중 사실과 다른 것 | 1개 (dawn-breakwater) |
| 키워드 | 사진당 9–12개, 평균 11.1개, 모두 영어 |
| OCR 결과가 있는 사진 | 12장 중 1장 (쓸 만한 글자는 없음) |
| 이미지 URL 수명 | 300초 → 재검증 150초, 만료 270초 |
| 썸네일 | 80px, 500px + 원본 1024px |
| 검색 질의 테스트 | 5개 × 2방식, 10건 모두 200 |
| MCP 롤백 | 12번 |

## 정리

- AI 설명은 alt로 쓸 만합니다. 다만 한 번은 사람이 이미지와 대 봐야 합니다. 12장 중 1장이 틀렸습니다.
- 키워드는 태그 후보입니다. 분위기·장르 단어는 걸러야 합니다.
- 서명 URL의 수명을 먼저 재고 캐시를 정합니다. 5분이면 그 페이지는 정적으로 만들 수 없습니다.
- MCP로 행을 고칠 때는 FILE 컬럼이 살아남는지 한 행으로 먼저 확인합니다.

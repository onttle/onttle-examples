// example.onttle.com/help-center 아래에서 서비스한다 (게이트웨이가 /help-center/* 를 이 앱으로 프록시).
// next.config.ts의 basePath와 클라이언트 fetch가 같은 값을 쓰도록 한곳에 둔다.
// next/link·next/form은 basePath를 자동으로 붙이지만 fetch는 붙이지 않는다.
export const BASE_PATH = "/help-center";

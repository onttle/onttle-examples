// Served under example.onttle.com/help-center (the gateway proxies /help-center/* to this app).
// Kept in one place so basePath in next.config.ts and client-side fetch use the same value.
// next/link and next/form add the basePath automatically, but fetch does not.
export const BASE_PATH = "/help-center";

import { cacheLife } from "next/cache";

/**
 * Whether a moment has passed. Pages are prerendered, so "now" cannot be read while they render;
 * it is read inside a cache entry that lasts 60 seconds instead.
 */
export async function hasPassed(iso: string): Promise<boolean> {
  "use cache";
  cacheLife({ revalidate: 60 });
  return new Date(iso).getTime() < Date.now();
}

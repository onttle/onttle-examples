import type { Metadata } from "next";
import { Suspense } from "react";
import { PostList } from "@/components/post-card";
import { searchPosts } from "@/lib/onttle";

export const metadata: Metadata = { title: "검색", robots: { index: false } };

async function Results({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 100) ?? "";

  return (
    <>
      <form action="/search" className="mb-10 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="키워드로 글 찾기"
          aria-label="검색어"
          className="flex-1 rounded-md border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
        />
        <button className="rounded-md bg-neutral-900 px-4 py-2 text-white dark:bg-neutral-100 dark:text-neutral-900">검색</button>
      </form>
      {query ? (
        <>
          <p className="mb-8 text-sm text-neutral-500">&ldquo;{query}&rdquo; 검색 결과</p>
          <PostList posts={await searchPosts(query)} empty="검색 결과가 없습니다. 다른 키워드로 찾아보세요." />
        </>
      ) : (
        <p className="text-neutral-500">검색어를 입력하세요.</p>
      )}
    </>
  );
}

export default function SearchPage(props: PageProps<"/search">) {
  return (
    <>
      <h1 className="mb-6 text-3xl font-bold">검색</h1>
      <Suspense fallback={<p className="text-neutral-500">검색 중…</p>}>
        <Results searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

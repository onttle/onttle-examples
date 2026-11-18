import type { Metadata } from "next";
import Form from "next/form";
import { Suspense } from "react";
import { PostList } from "@/components/post-card";
import { searchPosts } from "@/lib/onttle";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

async function Results({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 100) ?? "";

  return (
    <>
      <Form action="/search" className="mb-10 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Find posts by keyword"
          aria-label="Search query"
          className="flex-1 rounded-md border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
        />
        <button className="rounded-md bg-neutral-900 px-4 py-2 text-white dark:bg-neutral-100 dark:text-neutral-900">Search</button>
      </Form>
      {query ? (
        <>
          <p className="mb-8 text-sm text-neutral-500">Results for &ldquo;{query}&rdquo;</p>
          <PostList posts={await searchPosts(query)} empty="No results. Try a different keyword." />
        </>
      ) : (
        <p className="text-neutral-500">Enter a search term.</p>
      )}
    </>
  );
}

export default function SearchPage(props: PageProps<"/search">) {
  return (
    <>
      <h1 className="mb-6 text-3xl font-bold">Search</h1>
      <Suspense fallback={<p className="text-neutral-500">Searching…</p>}>
        <Results searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

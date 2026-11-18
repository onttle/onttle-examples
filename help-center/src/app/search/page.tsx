import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { faqHref, searchFaqs } from "@/lib/onttle";
import { topicLabel } from "@/lib/topics";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

async function Results({ query }: { query: string }) {
  const results = await searchFaqs(query);
  const askHref = `/ask?q=${encodeURIComponent(query)}`;

  if (results.length === 0) {
    return (
      <p className="text-neutral-500">
        No similar FAQs found.{" "}
        <Link href={askHref} className="underline">
          Ask AI
        </Link>
      </p>
    );
  }
  return (
    <>
      <ul className="space-y-4">
        {results.map((faq) => (
          <li key={faq.id} className="rounded-lg border border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <Link href={faqHref(faq)} className="font-medium hover:underline">
              {faq.data.question}
            </Link>
            <p className="mt-1 text-xs text-neutral-500">
              {topicLabel(faq.data.topic?.name)} · similarity {faq.score.toFixed(2)}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-neutral-500">
        Not what you were looking for?{" "}
        <Link href={askHref} className="underline">
          Ask AI
        </Link>
      </p>
    </>
  );
}

async function SearchBody({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 100) ?? "";

  return (
    <>
      <Form action="/search" className="mb-10 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="e.g. I want to change my payment method"
          aria-label="Search query"
          className="flex-1 rounded-md border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
        />
        <button className="rounded-md bg-neutral-900 px-4 py-2 text-white dark:bg-neutral-100 dark:text-neutral-900">
          Search
        </button>
      </Form>
      {query ? (
        <>
          <p className="mb-6 text-sm text-neutral-500">FAQs similar in meaning to &ldquo;{query}&rdquo;</p>
          <Suspense key={query} fallback={<p className="text-neutral-500">Searching…</p>}>
            <Results query={query} />
          </Suspense>
        </>
      ) : (
        <p className="text-neutral-500">Finds FAQs with a similar meaning, even when the words do not match exactly.</p>
      )}
    </>
  );
}

export default function SearchPage(props: PageProps<"/search">) {
  return (
    <>
      <h1 className="mb-6 text-3xl font-bold">Semantic search</h1>
      <Suspense fallback={<p className="text-neutral-500">Loading…</p>}>
        <SearchBody searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { faqHref, searchFaqs } from "@/lib/onttle";
import { topicLabel } from "@/lib/topics";

export const metadata: Metadata = { title: "검색", robots: { index: false } };

async function Results({ query }: { query: string }) {
  const results = await searchFaqs(query);
  const askHref = `/ask?q=${encodeURIComponent(query)}`;

  if (results.length === 0) {
    return (
      <p className="text-neutral-500">
        비슷한 FAQ를 찾지 못했습니다.{" "}
        <Link href={askHref} className="underline">
          AI에게 물어보기
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
              {topicLabel(faq.data.topic?.name)} · 유사도 {faq.score.toFixed(2)}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-neutral-500">
        원하는 답이 없나요?{" "}
        <Link href={askHref} className="underline">
          AI에게 물어보기
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
          placeholder="예: 결제 수단을 바꾸고 싶어요"
          aria-label="검색어"
          className="flex-1 rounded-md border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
        />
        <button className="rounded-md bg-neutral-900 px-4 py-2 text-white dark:bg-neutral-100 dark:text-neutral-900">
          검색
        </button>
      </Form>
      {query ? (
        <>
          <p className="mb-6 text-sm text-neutral-500">&ldquo;{query}&rdquo;와 뜻이 비슷한 FAQ</p>
          <Suspense key={query} fallback={<p className="text-neutral-500">검색 중…</p>}>
            <Results query={query} />
          </Suspense>
        </>
      ) : (
        <p className="text-neutral-500">단어가 정확히 같지 않아도 뜻이 비슷한 FAQ를 찾습니다.</p>
      )}
    </>
  );
}

export default function SearchPage(props: PageProps<"/search">) {
  return (
    <>
      <h1 className="mb-6 text-3xl font-bold">의미 검색</h1>
      <Suspense fallback={<p className="text-neutral-500">불러오는 중…</p>}>
        <SearchBody searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

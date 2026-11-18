import Link from "next/link";
import { Suspense } from "react";
import { PostList } from "@/components/post-card";
import { listPosts, listTags } from "@/lib/onttle";

async function Tags() {
  const tags = await listTags();
  if (tags.length === 0) return null;
  return (
    <ul className="mb-10 flex flex-wrap gap-2 text-sm">
      {tags.map((t) => (
        <li key={t.name}>
          <Link href={`/tags/${encodeURIComponent(t.name)}`} className="text-neutral-600 hover:underline dark:text-neutral-400">
            #{t.name} <span className="text-neutral-400">({t.count})</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Posts({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const { page: raw } = await searchParams;
  const page = Math.max(1, Number(raw) || 1);
  const { posts, pagination } = await listPosts(page);

  return (
    <>
      <PostList posts={posts} empty="아직 발행된 글이 없습니다." />
      {pagination.totalPages > 1 && (
        <nav className="mt-12 flex justify-between text-sm" aria-label="페이지">
          {page > 1 ? <Link href={page === 2 ? "/" : `/?page=${page - 1}`}>← 최신 글</Link> : <span />}
          <span className="text-neutral-500">
            {page} / {pagination.totalPages}
          </span>
          {page < pagination.totalPages ? <Link href={`/?page=${page + 1}`}>이전 글 →</Link> : <span />}
        </nav>
      )}
    </>
  );
}

export default function Home(props: PageProps<"/">) {
  return (
    <>
      <h1 className="mb-6 text-3xl font-bold">최신 글</h1>
      <Suspense>
        <Tags />
      </Suspense>
      <Suspense fallback={<p className="text-neutral-500">불러오는 중…</p>}>
        <Posts searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

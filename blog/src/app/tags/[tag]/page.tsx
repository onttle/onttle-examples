import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PostList } from "@/components/post-card";
import { listPostsByTag, listTags } from "@/lib/onttle";

export async function generateStaticParams() {
  const tags = await listTags();
  // Cache Components는 빈 배열을 허용하지 않음 → 글이 없을 때는 404가 나는 자리표시 경로 하나
  return tags.length > 0 ? tags.map((t) => ({ tag: t.name })) : [{ tag: "_" }];
}

export async function generateMetadata({ params }: PageProps<"/tags/[tag]">): Promise<Metadata> {
  const { tag } = await params;
  return { title: `#${decodeURIComponent(tag)}` };
}

async function TagPosts({ params }: { params: PageProps<"/tags/[tag]">["params"] }) {
  const tag = decodeURIComponent((await params).tag);
  const posts = await listPostsByTag(tag);
  if (posts.length === 0) notFound();
  return (
    <>
      <h1 className="mb-8 text-3xl font-bold">
        #{tag} <span className="text-lg font-normal text-neutral-500">{posts.length}개의 글</span>
      </h1>
      <PostList posts={posts} empty="" />
    </>
  );
}

export default function TagPage(props: PageProps<"/tags/[tag]">) {
  return (
    <Suspense fallback={<p className="text-neutral-500">불러오는 중…</p>}>
      <TagPosts params={props.params} />
    </Suspense>
  );
}

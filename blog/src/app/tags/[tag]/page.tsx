import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PostList } from "@/components/post-card";
import { listPostsByTag, listTags } from "@/lib/onttle";

export async function generateStaticParams() {
  const tags = await listTags();
  // Cache Components does not allow an empty array → return one placeholder path (404) when there are no posts
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
        #{tag} <span className="text-lg font-normal text-neutral-500">{posts.length === 1 ? "1 post" : `${posts.length} posts`}</span>
      </h1>
      <PostList posts={posts} empty="" />
    </>
  );
}

export default function TagPage(props: PageProps<"/tags/[tag]">) {
  return (
    <Suspense fallback={<p className="text-neutral-500">Loading…</p>}>
      <TagPosts params={props.params} />
    </Suspense>
  );
}

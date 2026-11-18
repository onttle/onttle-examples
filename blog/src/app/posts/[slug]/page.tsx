import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TagLinks } from "@/components/tag-links";
import { coverUrl, formatDate, getPostBySlug, listPosts } from "@/lib/onttle";

// At build time only the first page of latest posts is prerendered; the rest are generated on first request and cached.
export async function generateStaticParams() {
  const { posts } = await listPosts(1);
  const params = posts.filter((p) => p.slug).map((p) => ({ slug: p.slug! }));
  // Cache Components does not allow an empty array → return one placeholder path (404) when there are no posts
  return params.length > 0 ? params : [{ slug: "_" }];
}

export async function generateMetadata({ params }: PageProps<"/posts/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(decodeURIComponent(slug));
  if (!post) return {};
  const cover = coverUrl(post);
  const description = post.data.excerpt ?? undefined;
  return {
    title: post.data.title,
    description,
    openGraph: {
      type: "article",
      title: post.data.title,
      description,
      publishedTime: post.published_at ?? undefined,
      images: cover ? [cover] : undefined,
    },
  };
}

async function PostBody({ params }: { params: PageProps<"/posts/[slug]">["params"] }) {
  const { slug } = await params;
  const post = await getPostBySlug(decodeURIComponent(slug));
  if (!post) notFound();

  const cover = coverUrl(post);
  return (
    <article>
      <header className="mb-8">
        <time className="text-sm text-neutral-500" dateTime={post.published_at ?? undefined}>
          {formatDate(post.published_at)}
        </time>
        <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">{post.data.title}</h1>
        {post.data.excerpt && <p className="mt-3 text-lg text-neutral-600 dark:text-neutral-400">{post.data.excerpt}</p>}
        <TagLinks tags={post.data.tags} className="mt-4" />
      </header>
      {cover && (
        <Image
          src={cover}
          alt=""
          width={post.data.cover_image?.meta.width ?? 1200}
          height={post.data.cover_image?.meta.height ?? 630}
          priority
          className="mb-10 w-full rounded-lg border border-neutral-200 dark:border-neutral-800"
        />
      )}
      {/* body is Markdown stored in a TEXT column. Raw HTML is not rendered */}
      <div className="prose prose-neutral max-w-none dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.data.body ?? ""}</ReactMarkdown>
      </div>
    </article>
  );
}

export default function PostPage(props: PageProps<"/posts/[slug]">) {
  return (
    <>
      <Suspense fallback={<p className="text-neutral-500">Loading…</p>}>
        <PostBody params={props.params} />
      </Suspense>
      <p className="mt-16 text-sm">
        <Link href="/" className="hover:underline">
          ← All posts
        </Link>
      </p>
    </>
  );
}

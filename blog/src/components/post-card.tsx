import Image from "next/image";
import Link from "next/link";
import { coverUrl, formatDate, postHref, type Post } from "@/lib/onttle";
import { TagLinks } from "./tag-links";

export function PostCard({ post }: { post: Post }) {
  const cover = coverUrl(post);
  return (
    <article className="flex flex-col gap-4 sm:flex-row">
      {cover && (
        <Link href={postHref(post)} className="shrink-0">
          <Image
            src={cover}
            alt=""
            width={240}
            height={135}
            className="aspect-video w-full rounded-md border border-neutral-200 object-cover sm:w-48 dark:border-neutral-800"
          />
        </Link>
      )}
      <div className="min-w-0">
        <time className="text-sm text-neutral-500" dateTime={post.published_at ?? undefined}>
          {formatDate(post.published_at)}
        </time>
        <h2 className="mt-1 text-xl font-semibold">
          <Link href={postHref(post)} className="hover:underline">
            {post.data.title}
          </Link>
        </h2>
        {post.data.excerpt && <p className="mt-2 text-neutral-600 dark:text-neutral-400">{post.data.excerpt}</p>}
        <TagLinks tags={post.data.tags} className="mt-3" />
      </div>
    </article>
  );
}

export function PostList({ posts, empty }: { posts: Post[]; empty: string }) {
  if (posts.length === 0) return <p className="text-neutral-500">{empty}</p>;
  return (
    <ul className="flex flex-col gap-10">
      {posts.map((post) => (
        <li key={post.id}>
          <PostCard post={post} />
        </li>
      ))}
    </ul>
  );
}

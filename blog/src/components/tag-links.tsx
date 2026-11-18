import Link from "next/link";
export function TagLinks({ tags, className = "" }: { tags: string[] | null; className?: string }) {
  if (!tags?.length) return null;
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`}>
      {tags.map((tag) => (
        <li key={tag}>
          <Link
            href={`/tags/${encodeURIComponent(tag)}`}
            className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-sm text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
          >
            #{tag}
          </Link>
        </li>
      ))}
    </ul>
  );
}

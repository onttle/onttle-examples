import Link from "next/link";
import { Suspense } from "react";
import { Badges, formatDate } from "@/components/badges";
import { listFeedback, listKinds } from "@/lib/onttle";

const PAGE_SIZE = 10;

function href(kind: string | undefined, page: number) {
  const params = new URLSearchParams();
  if (kind) params.set("kind", kind);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

/**
 * The list reads ?kind and ?page (request-time), so it streams inside <Suspense>; the data itself comes from
 * the cached listFeedback(). The API ignores `filter` and `size`, so filtering and paging happen here.
 */
async function FeedbackList({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const params = await searchParams;
  const kindParam = typeof params.kind === "string" ? params.kind : undefined;
  const pageParam = Number(typeof params.page === "string" ? params.page : 1);

  const [all, kinds] = await Promise.all([listFeedback(), listKinds()]);
  const kind = kinds.find((k) => k.id === kindParam)?.id;
  const rows = kind ? all.filter((f) => f.data.kind?.id === kind) : all;

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? Math.min(pageParam, totalPages) : 1;
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tab = (active: boolean) =>
    `rounded-full px-3 py-1 ${active ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`;

  return (
    <>
      <nav className="mt-8 flex flex-wrap gap-2 text-sm" aria-label="Filter by type">
        <Link href="/" className={tab(!kind)}>
          All <span className="opacity-60">{all.length}</span>
        </Link>
        {kinds.map((k) => (
          <Link key={k.id} href={href(k.id, 1)} className={tab(kind === k.id)}>
            {k.name} <span className="opacity-60">{all.filter((f) => f.data.kind?.id === k.id).length}</span>
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
          <p>No feedback here yet.</p>
          <Link href="/new" className="mt-2 inline-block text-sm underline">
            Be the first to leave some
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {shown.map((f) => (
            <li key={f.id}>
              <Link
                href={`/f/${f.id}`}
                className="block rounded-lg border border-neutral-200 p-4 transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
              >
                <Badges kind={f.data.kind} progress={f.data.progress} />
                <h2 className="mt-2 font-medium">{f.data.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">{f.data.body}</p>
                <p className="mt-2 text-xs text-neutral-500">
                  {f.data.author_name || "Member"} · {formatDate(f.created_at)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="mt-8 flex items-center justify-between text-sm" aria-label="Pages">
          {page > 1 ? <Link href={href(kind, page - 1)} className="hover:underline">← Newer</Link> : <span />}
          <span className="text-neutral-500">
            {page} / {totalPages}
          </span>
          {page < totalPages ? <Link href={href(kind, page + 1)} className="hover:underline">Older →</Link> : <span />}
        </nav>
      )}
    </>
  );
}

export default function Home(props: PageProps<"/">) {
  return (
    <>
      <h1 className="text-2xl font-bold">What should MemoFarm do next?</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Request a feature, report a bug or ask a question. Anyone can read; sign up to post. Only you can edit or
        delete what you wrote.
      </p>
      <Suspense fallback={<p className="mt-8 text-neutral-500">Loading…</p>}>
        <FeedbackList searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

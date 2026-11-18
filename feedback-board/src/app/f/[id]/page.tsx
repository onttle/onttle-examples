import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badges, formatDate } from "@/components/badges";
import { DeleteButton } from "@/components/forms";
import { getFeedback, listFeedback } from "@/lib/onttle";
import { readSession } from "@/lib/session";

export async function generateStaticParams() {
  const rows = await listFeedback();
  // Cache Components does not allow an empty array → one placeholder path (404) when there is no feedback
  return rows.length > 0 ? rows.map((f) => ({ id: f.id })) : [{ id: "_" }];
}

export async function generateMetadata({ params }: PageProps<"/f/[id]">): Promise<Metadata> {
  const { id } = await params;
  const row = await getFeedback(id);
  return row ? { title: row.data.title } : {};
}

/**
 * Edit and Delete show for any signed-in member: the API does not say who owns a row, so the app cannot
 * tell. Onttle's `owner` rule decides — another member's row answers 403, shown as a message.
 */
async function OwnerActions({ id }: { id: string }) {
  const session = await readSession();
  if (!session.signedIn) return null;
  return (
    <div className="mt-8 flex items-start gap-6 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      <Link href={`/f/${id}/edit`} className="text-sm hover:underline">
        Edit
      </Link>
      <DeleteButton id={id} />
    </div>
  );
}

async function FeedbackBody({ params }: { params: PageProps<"/f/[id]">["params"] }) {
  const { id } = await params;
  const row = await getFeedback(id);
  if (!row) notFound();

  return (
    <article>
      <Badges kind={row.data.kind} progress={row.data.progress} />
      <h1 className="mt-3 text-2xl font-bold leading-snug">{row.data.title}</h1>
      <p className="mt-2 text-sm text-neutral-500">
        {row.data.author_name || "Member"} · {formatDate(row.created_at)}
        {row.updated_at && row.updated_at !== row.created_at ? " · edited" : ""}
      </p>
      <p className="mt-6 whitespace-pre-wrap leading-relaxed">{row.data.body}</p>
      <Suspense fallback={null}>
        <OwnerActions id={row.id} />
      </Suspense>
    </article>
  );
}

export default function FeedbackPage(props: PageProps<"/f/[id]">) {
  return (
    <>
      <Suspense fallback={<p className="text-neutral-500">Loading…</p>}>
        <FeedbackBody params={props.params} />
      </Suspense>
      <Link href="/" className="mt-12 inline-block text-sm hover:underline">
        ← All feedback
      </Link>
    </>
  );
}

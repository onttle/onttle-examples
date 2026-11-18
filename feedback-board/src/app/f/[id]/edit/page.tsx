import { notFound } from "next/navigation";
import { Suspense } from "react";
import { updateAction } from "@/app/actions";
import { FeedbackForm } from "@/components/forms";
import { getFeedback, listKinds } from "@/lib/onttle";

export const metadata = { title: "Edit feedback" };

async function EditForm({ params }: { params: PageProps<"/f/[id]/edit">["params"] }) {
  const { id } = await params;
  const [row, kinds] = await Promise.all([getFeedback(id), listKinds()]);
  if (!row) notFound();

  return (
    <FeedbackForm
      action={updateAction.bind(null, row.id)}
      kinds={kinds}
      defaults={{ title: row.data.title, body: row.data.body, kind: row.data.kind?.id ?? "" }}
      submitLabel="Save"
      cancelHref={`/f/${row.id}`}
    />
  );
}

// The proxy sends visitors without a session to /login. Whether this member owns the row is decided by
// Onttle when the form is saved (403 → "You can only edit or delete your own feedback.").
export default function EditPage(props: PageProps<"/f/[id]/edit">) {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Edit feedback</h1>
      <Suspense fallback={<p className="text-neutral-500">Loading…</p>}>
        <EditForm params={props.params} />
      </Suspense>
    </>
  );
}

import { createAction } from "@/app/actions";
import { FeedbackForm } from "@/components/forms";
import { listKinds } from "@/lib/onttle";

export const metadata = { title: "New feedback" };

// The proxy sends visitors without a session to /login?next=/new.
export default async function NewPage() {
  const kinds = await listKinds();
  return (
    <>
      <h1 className="text-2xl font-bold">New feedback</h1>
      <p className="mt-2 mb-6 text-sm text-neutral-600 dark:text-neutral-400">
        Your display name is shown with the post. You can edit or delete it later.
      </p>
      <FeedbackForm action={createAction} kinds={kinds} submitLabel="Post" cancelHref="/" />
    </>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-10 text-center">
      <h1 className="text-2xl font-bold">Not found</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">This feedback does not exist or was deleted.</p>
      <Link href="/" className="mt-6 inline-block underline">
        All feedback
      </Link>
    </div>
  );
}

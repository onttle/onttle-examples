import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { readSession } from "@/lib/session";

/** The only per-visitor part of the header. It reads cookies, so it renders at request time inside <Suspense>. */
export async function UserNav() {
  const session = await readSession();

  if (!session.signedIn) {
    return (
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/login" className="hover:underline">
          Log in
        </Link>
        <Link href="/signup" className="rounded-md bg-neutral-900 px-3 py-1.5 text-white dark:bg-neutral-100 dark:text-neutral-900">
          Sign up
        </Link>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-4 text-sm">
      <span className="hidden text-neutral-500 sm:inline">{session.name}</span>
      <form action={logoutAction}>
        <button type="submit" className="hover:underline">
          Log out
        </button>
      </form>
      <Link href="/new" className="rounded-md bg-neutral-900 px-3 py-1.5 text-white dark:bg-neutral-100 dark:text-neutral-900">
        New feedback
      </Link>
    </nav>
  );
}

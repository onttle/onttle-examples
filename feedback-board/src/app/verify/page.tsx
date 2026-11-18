import Link from "next/link";
import { Suspense } from "react";
import { OnttleError, verifyEmail } from "@/lib/onttle";

export const metadata = { title: "Verify e-mail" };

/** The verification e-mail links here with ?token=…; the server confirms it. Verifying twice is harmless. */
async function Result({ searchParams }: { searchParams: PageProps<"/verify">["searchParams"] }) {
  const { token } = await searchParams;
  if (typeof token !== "string" || !token) {
    return <p>This link is missing its token. Open the link from the e-mail again.</p>;
  }

  try {
    await verifyEmail(token);
  } catch (e) {
    const code = e instanceof OnttleError ? e.code : null;
    const message =
      code === "AUTH_TOKEN_EXPIRED"
        ? "This link has expired. Log in to get a new one."
        : code === "AUTH_SIGNUP_PAUSED"
          ? "Sign-ups are paused for this demo right now. The same link will work again later."
          : "This link is not valid. Log in to get a new one.";
    return (
      <>
        <p>{message}</p>
        <Link href="/login" className="mt-6 inline-block underline">
          Log in
        </Link>
      </>
    );
  }

  return (
    <>
      <p>Your e-mail is verified. You can log in and post now.</p>
      <Link href="/login" className="mt-6 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900">
        Log in
      </Link>
    </>
  );
}

export default function VerifyPage(props: PageProps<"/verify">) {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">E-mail verification</h1>
      <Suspense fallback={<p className="text-neutral-500">Checking the link…</p>}>
        <Result searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

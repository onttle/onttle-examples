import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/forms";

export const metadata = { title: "Log in" };

async function Form({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : "/"} />;
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Log in</h1>
      <Suspense fallback={null}>
        <Form searchParams={props.searchParams} />
      </Suspense>
      <p className="mt-6 text-sm text-neutral-500">
        New here?{" "}
        <Link href="/signup" className="underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

import Link from "next/link";
import { SignupForm } from "@/components/forms";

export const metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold">Sign up</h1>
      <p className="mt-2 mb-6 text-sm text-neutral-600 dark:text-neutral-400">
        This is a demo. Sign-ups may be paused when the monthly limit is reached.
      </p>
      <SignupForm />
      <p className="mt-6 text-sm text-neutral-500">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

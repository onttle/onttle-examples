import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-bold">FAQ not found</h1>
      <p className="mt-2 text-neutral-500">The address changed, or the FAQ is not published yet.</p>
      <Link href="/" className="mt-6 inline-block underline">
        Back to all FAQs
      </Link>
    </div>
  );
}

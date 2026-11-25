import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-10 text-center">
      <h1 className="text-2xl font-bold">Not found</h1>
      <p className="mt-2 text-neutral-600">This photo does not exist or has been taken down.</p>
      <Link href="/" className="mt-6 inline-block underline">
        All photos
      </Link>
    </div>
  );
}

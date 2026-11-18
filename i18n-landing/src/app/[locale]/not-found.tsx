import Link from "next/link";

// Shown for any locale other than ko and en (e.g. /ja). No translations are loaded here.
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-32 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-neutral-500">This page is available in Korean and English.</p>
      <p className="mt-6 flex justify-center gap-4">
        <Link href="/ko" className="underline">
          한국어
        </Link>
        <Link href="/en" className="underline">
          English
        </Link>
      </p>
    </main>
  );
}

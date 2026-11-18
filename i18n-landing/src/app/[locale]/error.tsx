"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  // Never show error details (response body, keys) on screen.
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-32 text-center">
      <h1 className="text-2xl font-bold">Could not load the page</h1>
      <p className="mt-2 text-neutral-500">Please try again in a moment.</p>
      <button onClick={reset} className="mt-6 underline">
        Try again
      </button>
    </main>
  );
}

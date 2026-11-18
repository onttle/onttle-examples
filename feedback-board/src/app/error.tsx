"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-10 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">The feedback could not be loaded. Please try again.</p>
      <button type="button" onClick={reset} className="mt-6 underline">
        Try again
      </button>
    </div>
  );
}

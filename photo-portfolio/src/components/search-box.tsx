import Form from "next/form";

export const MAX_QUERY = 100;

/** A GET form to /search. next/form adds the basePath and navigates client-side. */
export function SearchBox({ q = "", mode = "semantic" }: { q?: string; mode?: "semantic" | "keyword" }) {
  return (
    <Form action="/search" className="flex w-full max-w-md gap-2" role="search">
      <input
        name="q"
        defaultValue={q}
        maxLength={MAX_QUERY}
        placeholder="Search by sentence: a rainy alley at night"
        aria-label="Search photos"
        className="min-w-0 flex-1 rounded border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-900 focus:outline-none"
      />
      {mode === "keyword" && <input type="hidden" name="mode" value="keyword" />}
      <button type="submit" className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white">
        Search
      </button>
    </Form>
  );
}

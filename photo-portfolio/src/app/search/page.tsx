import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PhotoGrid } from "@/components/photo-grid";
import { MAX_QUERY, SearchBox } from "@/components/search-box";
import { OnttleError, searchPhotos, type SearchMode } from "@/lib/onttle";

export const metadata: Metadata = { title: "Search" };

const MODE_LABEL: Record<SearchMode, string> = { semantic: "Semantic search (Embeddings)", keyword: "Keyword search (BM25)" };

async function Results({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const params = await searchParams;
  const raw = typeof params.q === "string" ? params.q : "";
  const q = raw.trim().slice(0, MAX_QUERY);
  const mode: SearchMode = params.mode === "keyword" ? "keyword" : "semantic";
  const other: SearchMode = mode === "semantic" ? "keyword" : "semantic";

  if (process.env.SEARCH_DISABLED === "true") {
    return <p className="mt-8 text-neutral-500">Search is turned off in the demo right now. Browse the photos by series instead.</p>;
  }

  return (
    <>
      <div className="mt-4">
        <SearchBox q={q} mode={mode} />
      </div>
      <p className="mt-3 text-sm text-neutral-500">
        {MODE_LABEL[mode]} ·{" "}
        <Link
          href={`/search?${new URLSearchParams({ q, ...(other === "keyword" ? { mode: "keyword" } : {}) })}`}
          className="underline"
        >
          Same query with {MODE_LABEL[other]}
        </Link>
      </p>
      {q ? <Hits q={q} mode={mode} /> : <p className="mt-8 text-neutral-500">Search with a sentence, such as “a rainy alley at night”.</p>}
    </>
  );
}

/** Empty queries never reach here, so they never cost a call. */
async function Hits({ q, mode }: { q: string; mode: SearchMode }) {
  let hits;
  try {
    hits = await searchPhotos(q, mode);
  } catch (e) {
    console.error(e instanceof OnttleError ? e.message : "search failed");
    return <p className="mt-8 text-neutral-500">Search is not working right now. Please try again in a moment.</p>;
  }
  if (hits.length === 0) return <p className="mt-8 text-neutral-500">No photos match “{q}”.</p>;

  const scores = new Map(hits.map((h) => [h.photo.id, h.score]));
  return (
    <div className="mt-8">
      <PhotoGrid
        photos={hits.map((h) => h.photo)}
        extra={(photo) => <p className="text-xs text-neutral-400">Score {(scores.get(photo.id) ?? 0).toFixed(2)}</p>}
      />
    </div>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <>
      <h1 className="text-2xl font-semibold">Search photos</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Words that are not in a title or tag work too: the description Onttle’s AI wrote at upload is searched as well.
      </p>
      <Suspense fallback={<p className="mt-8 text-neutral-500">Searching…</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </>
  );
}

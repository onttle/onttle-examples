import type { Category } from "@/lib/onttle";

// Colors by the category value name as created in Onttle (Suggestion · Bug Report · Question / Pending · Planned · Complete).
const KIND_STYLE: Record<string, string> = {
  Suggestion: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  "Bug Report": "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  Question: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
};
const PROGRESS_STYLE: Record<string, string> = {
  Pending: "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400",
  Planned: "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400",
  Complete: "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400",
};

export function Badges({ kind, progress }: { kind: Category | null; progress: Category | null }) {
  return (
    <span className="flex flex-wrap items-center gap-2 text-xs">
      {kind && (
        <span className={`rounded px-2 py-0.5 ${KIND_STYLE[kind.name] ?? "bg-neutral-100 dark:bg-neutral-800"}`}>
          {kind.name}
        </span>
      )}
      {progress ? (
        <span className={`rounded border px-2 py-0.5 ${PROGRESS_STYLE[progress.name] ?? "border-neutral-300"}`}>
          {progress.name}
        </span>
      ) : (
        <span className="rounded border border-dashed border-neutral-300 px-2 py-0.5 text-neutral-500 dark:border-neutral-700">
          New
        </span>
      )}
    </span>
  );
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Seoul" });
}

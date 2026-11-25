import Link from "next/link";
import type { Category } from "@/lib/onttle";

/** "All" plus one tab per series that has photos. The series URL is the category value id (categories have no slug). */
export function SeriesTabs({ series, current }: { series: Category[]; current: string | null }) {
  const tab = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 hover:border-neutral-500"}`;
  return (
    <nav aria-label="Series" className="flex flex-wrap gap-2">
      <Link href="/" className={tab(current === null)} aria-current={current === null ? "page" : undefined}>
        All
      </Link>
      {series.map((s) => (
        <Link key={s.id} href={`/series/${s.id}`} className={tab(current === s.id)} aria-current={current === s.id ? "page" : undefined}>
          {s.name}
        </Link>
      ))}
    </nav>
  );
}

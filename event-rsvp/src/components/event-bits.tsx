import type { Category } from "@/lib/onttle";

// Colors by the category value name as created in Onttle ("Event format": Talk Night · Workshop · Online).
const FORMAT_STYLE: Record<string, string> = {
  "Talk Night": "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  Workshop: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  Online: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
};

export function FormatBadge({ format }: { format: Category | null }) {
  if (!format) return null;
  return (
    <span className={`rounded px-2 py-0.5 text-xs ${FORMAT_STYLE[format.name] ?? "bg-neutral-100 dark:bg-neutral-800"}`}>
      {format.name}
    </span>
  );
}

/** Makers' Night is a Seoul meetup: every time is shown in KST, whatever the visitor's zone. */
export function formatWhen(iso: string) {
  const when = new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
  return `${when} KST`;
}

/** Seats left as a number and a bar. `taken` can pass `capacity` when two people take the last seat at once. */
export function Seats({ taken, capacity }: { taken: number; capacity: number }) {
  const left = Math.max(0, capacity - taken);
  const full = left === 0;
  const percent = Math.min(100, Math.round((taken / capacity) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className={full ? "font-semibold text-rose-700 dark:text-rose-400" : "font-medium"}>
          {full ? "Full" : `${left} ${left === 1 ? "seat" : "seats"} left`}
        </span>
        <span className="text-xs text-neutral-500">
          {Math.min(taken, capacity)} / {capacity}
        </span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
        role="progressbar"
        aria-label="Seats taken"
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuenow={Math.min(taken, capacity)}
      >
        <div
          className={`h-full rounded-full ${full ? "bg-rose-500" : left <= 2 ? "bg-amber-500" : "bg-emerald-500"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

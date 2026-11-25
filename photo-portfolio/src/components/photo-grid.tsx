import Link from "next/link";
import type { Photo } from "@/lib/onttle";
import { PhotoImage } from "./photo-image";

/** 1 column on phones, 2 on tablets, 3 on desktops. `sizes` says the same, so phones fetch the small thumbnail. */
const GRID_SIZES = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

export function PhotoGrid({ photos, extra }: { photos: Photo[]; extra?: (photo: Photo) => React.ReactNode }) {
  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {photos.map((photo, i) => (
        <li key={photo.id}>
          <Link href={`/photos/${photo.slug}`} className="group block">
            <div className="aspect-[4/3] overflow-hidden bg-neutral-100">
              <PhotoImage
                photo={photo}
                sizes={GRID_SIZES}
                priority={i < 3}
                className="h-full w-full object-cover transition group-hover:opacity-90"
              />
            </div>
            <p className="mt-2 text-sm font-medium group-hover:underline">{photo.title}</p>
            <p className="text-xs text-neutral-500">
              {[photo.series?.name, photo.location].filter(Boolean).join(" · ")}
            </p>
            {extra?.(photo)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function EmptyPhotos() {
  return <p className="rounded border border-dashed border-neutral-300 p-10 text-center text-neutral-500">No photos yet</p>;
}

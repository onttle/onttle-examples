import Link from "next/link";
import { Suspense } from "react";
import { EmptyPhotos, PhotoGrid } from "@/components/photo-grid";
import { PhotoImage } from "@/components/photo-image";
import { SeriesTabs } from "@/components/series-tabs";
import { listPhotos, listSeries } from "@/lib/onttle";

async function Gallery() {
  const [photos, series] = await Promise.all([listPhotos(), listSeries()]);
  if (photos.length === 0) return <EmptyPhotos />;

  const featured = photos.filter((p) => p.featured).slice(0, 2);
  return (
    <>
      {featured.length > 0 && (
        <section aria-label="Featured photos" className="grid gap-6 md:grid-cols-2">
          {featured.map((photo) => (
            <Link key={photo.id} href={`/photos/${photo.slug}`} className="group block">
              <div className="aspect-[3/2] overflow-hidden bg-neutral-100">
                <PhotoImage
                  photo={photo}
                  sizes="(min-width: 768px) 50vw, 100vw"
                  priority
                  className="h-full w-full object-cover transition group-hover:opacity-90"
                />
              </div>
              <p className="mt-2 font-medium group-hover:underline">{photo.title}</p>
            </Link>
          ))}
        </section>
      )}
      <div className="mt-12">
        <SeriesTabs series={series} current={null} />
      </div>
      <div className="mt-6">
        <PhotoGrid photos={photos} />
      </div>
    </>
  );
}

export default function Home() {
  return (
    <>
      <h1 className="sr-only">Seo-ha Yun photo portfolio</h1>
      <Suspense fallback={<p className="text-neutral-500">Loading…</p>}>
        <Gallery />
      </Suspense>
    </>
  );
}

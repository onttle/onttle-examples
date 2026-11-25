import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmptyPhotos, PhotoGrid } from "@/components/photo-grid";
import { SeriesTabs } from "@/components/series-tabs";
import { listBySeries, listSeries } from "@/lib/onttle";

export async function generateMetadata({ params }: PageProps<"/series/[id]">): Promise<Metadata> {
  const { id } = await params;
  const current = (await listSeries()).find((s) => s.id === id);
  return current ? { title: current.name } : {};
}

// Rendered at request time: the signed image URLs live 5 minutes, too short to prerender (see lib/onttle.ts).
export default function SeriesPage({ params }: PageProps<"/series/[id]">) {
  return (
    <Suspense fallback={<p className="text-neutral-500">Loading…</p>}>
      <Series params={params} />
    </Suspense>
  );
}

async function Series({ params }: { params: PageProps<"/series/[id]">["params"] }) {
  const { id } = await params;
  const series = await listSeries();
  const current = series.find((s) => s.id === id);
  if (!current) notFound();

  const photos = await listBySeries(id);
  return (
    <>
      <h1 className="text-2xl font-semibold">{current.name}</h1>
      <div className="mt-6">
        <SeriesTabs series={series} current={id} />
      </div>
      <div className="mt-6">{photos.length > 0 ? <PhotoGrid photos={photos} /> : <EmptyPhotos />}</div>
    </>
  );
}

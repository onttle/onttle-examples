import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PhotoImage } from "@/components/photo-image";
import { formatDate } from "@/lib/format";
import { getPhoto, type AltSource } from "@/lib/onttle";

export async function generateMetadata({ params }: PageProps<"/photos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const photo = await getPhoto(slug);
  // No og:image: the signed URL would expire long before a link preview is shown again.
  return photo ? { title: photo.title, description: photo.alt } : {};
}

const ALT_LABEL: Record<AltSource, string> = {
  caption: "Caption written by a person",
  ai: "Description written by AI",
  title: "Photo title (no caption or AI description)",
};

// Rendered at request time: the signed image URLs live 5 minutes, too short to prerender (see lib/onttle.ts).
export default function PhotoPage({ params }: PageProps<"/photos/[slug]">) {
  return (
    <Suspense fallback={<p className="text-neutral-500">Loading…</p>}>
      <Photo params={params} />
    </Suspense>
  );
}

async function Photo({ params }: { params: PageProps<"/photos/[slug]">["params"] }) {
  const { slug } = await params;
  const photo = await getPhoto(slug);
  if (!photo) notFound();

  const { image } = photo;
  return (
    <article>
      <div className="flex justify-center bg-neutral-100">
        <PhotoImage photo={photo} sizes="(min-width: 1152px) 1152px, 100vw" priority className="h-auto max-h-[80vh] w-auto" />
      </div>

      <div className="mx-auto mt-8 max-w-2xl">
        <h1 className="text-2xl font-semibold">{photo.title}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {[formatDate(photo.shotAt), photo.location].filter(Boolean).join(" · ")}
          {photo.series && (
            <>
              {" · "}
              <Link href={`/series/${photo.series.id}`} className="underline">
                {photo.series.name}
              </Link>
            </>
          )}
        </p>

        {photo.caption && <p className="mt-6 leading-relaxed">{photo.caption}</p>}

        {image.keywords.length > 0 && (
          <ul aria-label="Keywords" className="mt-6 flex flex-wrap gap-2">
            {image.keywords.map((k) => (
              <li key={k}>
                <Link
                  href={`/search?q=${encodeURIComponent(k)}`}
                  className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-200"
                >
                  #{k}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <section className="mt-10 rounded border border-neutral-200 p-4 text-sm">
          <h2 className="font-medium">Alt text for this photo</h2>
          <p className="mt-1 text-xs text-neutral-500">Source: {ALT_LABEL[photo.altSource]}</p>
          <p className="mt-2 text-neutral-700">{photo.alt}</p>
          {image.descriptionGenerated && photo.altSource !== "ai" && (
            <>
              <h3 className="mt-4 font-medium">AI description (not used)</h3>
              <p className="mt-1 text-neutral-500">{image.descriptionGenerated}</p>
            </>
          )}
          {image.textVision && (
            <>
              <h3 className="mt-4 font-medium">Text in the photo (OCR)</h3>
              <p className="mt-1 whitespace-pre-line text-neutral-500">{image.textVision}</p>
            </>
          )}
        </section>
      </div>
    </article>
  );
}

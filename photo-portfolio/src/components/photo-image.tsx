import type { Photo } from "@/lib/onttle";

/**
 * A plain <img> with a srcset made from Onttle's thumbnail presets, not next/image:
 * Onttle already resized the photo, and its signed URLs expire, so they must not go into an image cache.
 * width/height from the file's meta keep the layout from jumping while it loads.
 */
export function PhotoImage({
  photo,
  sizes,
  className,
  priority,
}: {
  photo: Photo;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  const { image } = photo;
  const srcSet = image.sources.length > 1 ? image.sources.map((s) => `${s.url} ${s.width}w`).join(", ") : undefined;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see the comment above
    <img
      src={image.src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      width={image.width ?? undefined}
      height={image.height ?? undefined}
      alt={photo.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={className}
    />
  );
}

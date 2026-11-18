import { listPosts, postHref } from "@/lib/onttle";

function escape(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

export async function GET() {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/blog").replace(/\/$/, "");
  const { posts } = await listPosts(1);
  const items = posts
    .map(
      (p) => `<item>
  <title>${escape(p.data.title)}</title>
  <link>${site}${postHref(p)}</link>
  <guid>${site}${postHref(p)}</guid>
  ${p.published_at ? `<pubDate>${new Date(p.published_at).toUTCString()}</pubDate>` : ""}
  ${p.data.excerpt ? `<description>${escape(p.data.excerpt)}</description>` : ""}
</item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Onttle Blog</title>
<link>${site}</link>
<description>A Next.js tech blog example that uses Onttle as a headless CMS</description>
${items}
</channel></rss>`;

  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}

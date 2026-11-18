import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getFaq, listFaqs } from "@/lib/onttle";
import { topicLabel } from "@/lib/topics";

export async function generateStaticParams() {
  const faqs = await listFaqs();
  const params = faqs.filter((f) => f.slug).map((f) => ({ slug: f.slug! }));
  // Cache Components는 빈 배열을 허용하지 않음 → FAQ가 없을 때는 404가 나는 자리표시 경로 하나
  return params.length > 0 ? params : [{ slug: "_" }];
}

export async function generateMetadata({ params }: PageProps<"/faq/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const faq = await getFaq(decodeURIComponent(slug));
  if (!faq) return {};
  return { title: faq.data.question };
}

async function FaqBody({ params }: { params: PageProps<"/faq/[slug]">["params"] }) {
  const { slug } = await params;
  const faq = await getFaq(decodeURIComponent(slug));
  if (!faq) notFound();

  const keywords = faq.data.keywords ?? [];
  return (
    <article>
      <p className="text-sm text-neutral-500">{topicLabel(faq.data.topic?.name)}</p>
      <h1 className="mt-2 text-2xl font-bold leading-snug sm:text-3xl">{faq.data.question}</h1>
      {/* answer는 TEXT 컬럼에 저장된 마크다운. raw HTML은 렌더링하지 않는다 */}
      <div className="prose prose-neutral mt-8 max-w-none dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{faq.data.answer ?? ""}</ReactMarkdown>
      </div>
      {keywords.length > 0 && (
        <ul className="mt-8 flex flex-wrap gap-2 text-sm text-neutral-500">
          {keywords.map((k) => (
            <li key={k} className="rounded bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800">
              {k}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export default function FaqPage(props: PageProps<"/faq/[slug]">) {
  return (
    <>
      <Suspense fallback={<p className="text-neutral-500">불러오는 중…</p>}>
        <FaqBody params={props.params} />
      </Suspense>
      <div className="mt-16 flex justify-between text-sm">
        <Link href="/" className="hover:underline">
          ← FAQ 목록
        </Link>
        <Link href="/ask" className="hover:underline">
          해결되지 않았나요? AI에게 물어보기 →
        </Link>
      </div>
    </>
  );
}

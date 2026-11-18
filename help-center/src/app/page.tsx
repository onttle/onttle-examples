import Link from "next/link";
import { Suspense } from "react";
import { faqHref, listFaqs, listTopics, type Faq } from "@/lib/onttle";
import { topicLabel } from "@/lib/topics";

/** Groups FAQs in the stored category order. FAQs with no topic, or a topic not in the list, go last under "Other". */
function groupByTopic(faqs: Faq[], topicIds: string[]) {
  const groups = new Map<string, { name: string | null; faqs: Faq[] }>();
  for (const id of topicIds) groups.set(id, { name: null, faqs: [] });
  const etc: Faq[] = [];
  for (const faq of faqs) {
    const topic = faq.data.topic;
    const group = topic && groups.get(topic.id);
    if (group) {
      group.name = topic.name;
      group.faqs.push(faq);
    } else etc.push(faq);
  }
  const result = [...groups].filter(([, g]) => g.faqs.length > 0).map(([id, g]) => ({ id, ...g }));
  if (etc.length > 0) result.push({ id: "etc", name: null, faqs: etc });
  return result;
}

async function FaqGroups() {
  const [faqs, topics] = await Promise.all([listFaqs(), listTopics()]);
  if (faqs.length === 0) return <p className="text-neutral-500">No FAQs published yet.</p>;

  const groups = groupByTopic(
    faqs,
    topics.map((t) => t.id),
  );
  return (
    <div className="space-y-3">
      {groups.map((g, i) => (
        <details
          key={g.id}
          open={i === 0}
          className="rounded-lg border border-neutral-200 px-4 py-3 dark:border-neutral-800"
        >
          <summary className="cursor-pointer font-semibold">
            {topicLabel(g.name)} <span className="font-normal text-neutral-400">({g.faqs.length})</span>
          </summary>
          <ul className="mt-3 space-y-2">
            {g.faqs.map((faq) => (
              <li key={faq.id}>
                <Link href={faqHref(faq)} className="hover:underline">
                  {faq.data.question}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <>
      <h1 className="mb-2 text-3xl font-bold">How can we help?</h1>
      <p className="mb-8 text-neutral-600 dark:text-neutral-400">
        Browse frequently asked questions by topic, or ask the AI if you cannot find your answer. The AI answers from
        these FAQs and shows its sources.
      </p>
      <Suspense fallback={<p className="text-neutral-500">Loading…</p>}>
        <FaqGroups />
      </Suspense>
    </>
  );
}

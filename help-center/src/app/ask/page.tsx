import type { Metadata } from "next";
import { Suspense } from "react";
import { AskChat } from "@/components/ask-chat";

export const metadata: Metadata = { title: "Ask AI", robots: { index: false } };

async function Chat({ searchParams }: { searchParams: PageProps<"/ask">["searchParams"] }) {
  const { q } = await searchParams;
  const initial = (Array.isArray(q) ? q[0] : q)?.slice(0, 300) ?? "";
  return <AskChat initialQuestion={initial} />;
}

export default function AskPage(props: PageProps<"/ask">) {
  return (
    <>
      <h1 className="mb-2 text-3xl font-bold">Ask AI</h1>
      <p className="mb-8 text-sm text-neutral-600 dark:text-neutral-400">
        The AI answers from the help center FAQs and shows the FAQs it used as sources. This is a public demo, so
        question length and the number of questions are limited.
      </p>
      <Suspense>
        <Chat searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

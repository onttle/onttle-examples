import type { Metadata } from "next";
import { Suspense } from "react";
import { AskChat } from "@/components/ask-chat";

export const metadata: Metadata = { title: "AI에게 물어보기", robots: { index: false } };

async function Chat({ searchParams }: { searchParams: PageProps<"/ask">["searchParams"] }) {
  const { q } = await searchParams;
  const initial = (Array.isArray(q) ? q[0] : q)?.slice(0, 300) ?? "";
  return <AskChat initialQuestion={initial} />;
}

export default function AskPage(props: PageProps<"/ask">) {
  return (
    <>
      <h1 className="mb-2 text-3xl font-bold">AI에게 물어보기</h1>
      <p className="mb-8 text-sm text-neutral-600 dark:text-neutral-400">
        AI가 헬프센터 FAQ를 근거로 답하고, 참고한 FAQ를 출처로 보여줍니다. 공개 데모라 질문 길이와 횟수에 제한이
        있습니다.
      </p>
      <Suspense>
        <Chat searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

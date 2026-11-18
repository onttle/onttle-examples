"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  // 오류 내용(응답 본문, 키 등)은 화면에 보여주지 않는다.
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-bold">글을 불러오지 못했습니다</h1>
      <p className="mt-2 text-neutral-500">잠시 후 다시 시도해 주세요.</p>
      <button onClick={reset} className="mt-6 underline">
        다시 시도
      </button>
    </div>
  );
}

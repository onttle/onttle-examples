import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-bold">글을 찾을 수 없습니다</h1>
      <p className="mt-2 text-neutral-500">주소가 바뀌었거나 아직 발행되지 않은 글입니다.</p>
      <Link href="/" className="mt-6 inline-block underline">
        글 목록으로
      </Link>
    </div>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-bold">FAQ를 찾을 수 없습니다</h1>
      <p className="mt-2 text-neutral-500">주소가 바뀌었거나 아직 발행되지 않은 FAQ입니다.</p>
      <Link href="/" className="mt-6 inline-block underline">
        FAQ 목록으로
      </Link>
    </div>
  );
}

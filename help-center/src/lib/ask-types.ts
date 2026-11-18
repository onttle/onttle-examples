// /api/ask 요청·응답 모양. 클라이언트와 Route Handler가 함께 쓴다 (Onttle 타입과는 별개).

export interface AskRequest {
  message: string;
  chatId?: string | null;
}

export interface AskSource {
  slug: string;
  question: string;
  /** Onttle이 돌려준 유사도 점수 (없으면 null) */
  score: number | null;
}

export type AskError = "empty" | "too_long" | "turn_limit" | "bad_request" | "config" | "failed";

export type AskResponse =
  /** chatId가 null이면 이 대화를 이어갈 수 없다 → 다음 질문은 새 대화로 */
  | { chatId: string | null; message: string; sources: AskSource[]; turnsLeft: number }
  | { error: AskError };

// Request and response shapes of /api/ask, shared by the client and the Route Handler (separate from the Onttle types).

export interface AskRequest {
  message: string;
  chatId?: string | null;
}

export interface AskSource {
  slug: string;
  question: string;
  /** Similarity score returned by Onttle (null when missing) */
  score: number | null;
}

export type AskError = "empty" | "too_long" | "turn_limit" | "bad_request" | "config" | "failed";

export type AskResponse =
  /** A null chatId means this chat cannot be continued → the next question starts a new chat */
  | { chatId: string | null; message: string; sources: AskSource[]; turnsLeft: number }
  | { error: AskError };

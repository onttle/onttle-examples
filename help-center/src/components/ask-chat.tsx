"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BASE_PATH } from "@/lib/base-path";
import type { AskResponse, AskSource } from "@/lib/ask-types";

// The browser never calls Onttle directly. The key lives only on the server (/api/ask).

type Turn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; sources: AskSource[] }
  | { role: "error"; text: string };

const ERRORS: Record<string, string> = {
  too_long: "Your question is too long. Please shorten it and ask again.",
  empty: "Please enter a question.",
  turn_limit: "You have used all the questions for this chat. Please start a new chat.",
  config: "The help center is misconfigured and cannot answer right now. Please try again later.",
};

export function AskChat({ initialQuestion }: { initialQuestion: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [input, setInput] = useState(initialQuestion);
  const [pending, setPending] = useState(false);
  const [turnsLeft, setTurnsLeft] = useState<number | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || pending) return;

    setTurns((t) => [...t, { role: "user", text: message }]);
    setInput("");
    setPending(true);
    try {
      const res = await fetch(`${BASE_PATH}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, chatId }),
      });
      const body = (await res.json()) as AskResponse;
      if ("error" in body) {
        setTurns((t) => [...t, { role: "error", text: ERRORS[body.error] ?? "Could not get an answer. Please try again in a moment." }]);
        if (body.error === "turn_limit") setTurnsLeft(0);
      } else {
        setChatId(body.chatId);
        setTurnsLeft(body.turnsLeft);
        setTurns((t) => [...t, { role: "assistant", text: body.message, sources: body.sources }]);
      }
    } catch {
      setTurns((t) => [...t, { role: "error", text: "Could not get an answer because of a network error." }]);
    } finally {
      setPending(false);
    }
  }

  function reset() {
    setTurns([]);
    setChatId(null);
    setTurnsLeft(null);
  }

  const exhausted = turnsLeft === 0;

  return (
    <div>
      <ol className="space-y-6">
        {turns.map((turn, i) => (
          <li key={i} className={turn.role === "user" ? "flex justify-end" : ""}>
            {turn.role === "user" && (
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-neutral-900 px-4 py-2 text-white dark:bg-neutral-100 dark:text-neutral-900">
                {turn.text}
              </p>
            )}
            {turn.role === "assistant" && <Answer text={turn.text} sources={turn.sources} />}
            {turn.role === "error" && <p className="text-sm text-red-600 dark:text-red-400">{turn.text}</p>}
          </li>
        ))}
        {pending && <li className="text-sm text-neutral-500">Looking through the FAQs and writing an answer…</li>}
      </ol>

      <form onSubmit={onSubmit} className="mt-8">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={3}
          disabled={exhausted}
          placeholder={exhausted ? "Please start a new chat" : "e.g. How long do I have to get a refund?"}
          aria-label="Question"
          className="w-full resize-none rounded-md border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
        />
        <div className="mt-2 flex items-center justify-between gap-4 text-sm">
          <span className="text-neutral-500">
            {turnsLeft !== null && `${turnsLeft} ${turnsLeft === 1 ? "question" : "questions"} left`}
            {turns.length > 0 && (
              <button type="button" onClick={reset} className="ml-3 underline">
                New chat
              </button>
            )}
          </span>
          <button
            disabled={pending || exhausted || !input.trim()}
            className="rounded-md bg-neutral-900 px-4 py-2 text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function Answer({ text, sources }: { text: string; sources: AskSource[] }) {
  return (
    <div className="rounded-2xl border border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <div className="prose prose-neutral prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
      {sources.length > 0 ? (
        <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <p className="mb-2 text-xs text-neutral-500">Sources</p>
          <ul className="space-y-1 text-sm">
            {sources.map((s) => (
              <li key={s.slug}>
                <Link href={`/faq/${encodeURIComponent(s.slug)}`} className="hover:underline">
                  {s.question}
                </Link>
                {s.score !== null && <span className="ml-2 text-xs text-neutral-400">{s.score.toFixed(2)}</span>}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-xs text-neutral-500">
          No related FAQs found.{" "}
          <Link href="/" className="underline">
            Browse all FAQs
          </Link>
        </p>
      )}
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { rsvpAction, type FormState } from "@/app/actions";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
    >
      {pending ? "Saving your seat…" : "RSVP"}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">
        {label} {hint && <span className="font-normal text-neutral-500">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function RsvpForm({ slug }: { slug: string }) {
  const [state, action] = useActionState(rsvpAction.bind(null, slug), {} as FormState);

  if (state.closed) {
    return (
      <p role="status" className="rounded-md bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-900">
        {state.closed}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
      <Field label="Name">
        <input name="name" required maxLength={40} autoComplete="name" className={inputClass} />
      </Field>
      <Field label="E-mail">
        <input name="email" type="email" required maxLength={254} autoComplete="email" className={inputClass} />
      </Field>
      <Field label="Note" hint="(optional)">
        <textarea name="note" rows={3} maxLength={300} className={inputClass} />
      </Field>
      {/* Honeypot: off-screen and skipped by keyboard and screen readers. People leave it empty. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <p className="text-xs text-neutral-500">
        This is a demo: entries are deleted periodically. Your e-mail is used only to stop a second RSVP for the
        same event and is never shown on the site.
      </p>
      <Submit />
    </form>
  );
}

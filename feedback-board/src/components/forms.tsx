"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteAction,
  loginAction,
  resendAction,
  signupAction,
  type FormState,
} from "@/app/actions";

export const inputClass =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700";
const buttonClass =
  "rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900";

export function Submit({ children, className = buttonClass }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Working…" : children}
    </button>
  );
}

export function Message({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
        {state.error}
      </p>
    );
  }
  if (state.notice) {
    return (
      <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
        {state.notice}
      </p>
    );
  }
  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

// ---------- Auth ----------

export function ResendForm({ email }: { email: string }) {
  const [state, action] = useActionState(resendAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="email" value={email} />
      <Message state={state} />
      <Submit className="text-sm underline disabled:opacity-50">Resend the verification e-mail</Submit>
    </form>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signupAction, {});

  if (state.pendingEmail) {
    return (
      <div className="space-y-4">
        <Message state={state} />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Open the link in the e-mail to activate your account, then log in. No e-mail after a few minutes? Check
          the spam folder or send it again.
        </p>
        <ResendForm email={state.pendingEmail} />
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <Message state={state} />
      <Field label="Display name">
        <input name="name" required maxLength={40} autoComplete="nickname" className={inputClass} />
      </Field>
      <Field label="E-mail">
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </Field>
      <Field label="Password (8 characters or more)">
        <input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} />
      </Field>
      <label className="flex gap-2 text-sm text-neutral-600 dark:text-neutral-400">
        <input type="checkbox" name="agree" required className="mt-1" />
        <span>
          I understand this is a demo: my e-mail and display name are stored by Onttle to run sign-in, my display
          name is shown on what I post, and demo accounts are deleted periodically.
        </span>
      </label>
      <Submit>Create account</Submit>
    </form>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginAction, {});
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <Message state={state} />
        <input type="hidden" name="next" value={next} />
        <Field label="E-mail">
          <input name="email" type="email" required autoComplete="email" className={inputClass} />
        </Field>
        <Field label="Password">
          <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
        </Field>
        <Submit>Log in</Submit>
      </form>
      {state.pendingEmail && <ResendForm email={state.pendingEmail} />}
    </div>
  );
}

// ---------- Feedback ----------

export function FeedbackForm({
  action,
  kinds,
  defaults,
  submitLabel,
  cancelHref,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  kinds: { id: string; name: string }[];
  defaults?: { title: string; body: string; kind: string };
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      <Message state={state} />
      <Field label="Title">
        <input name="title" required maxLength={100} defaultValue={defaults?.title} className={inputClass} />
      </Field>
      <fieldset className="space-y-1 text-sm">
        <legend className="font-medium">Type</legend>
        <div className="flex flex-wrap gap-4 pt-1">
          {kinds.map((k, i) => (
            <label key={k.id} className="flex items-center gap-2">
              <input
                type="radio"
                name="kind"
                value={k.id}
                required
                defaultChecked={defaults ? defaults.kind === k.id : i === 0}
              />
              {k.name}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Details">
        <textarea name="body" required rows={8} defaultValue={defaults?.body} className={inputClass} />
      </Field>
      <div className="flex items-center gap-4">
        <Submit>{submitLabel}</Submit>
        <Link href={cancelHref} className="text-sm text-neutral-500 hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function DeleteButton({ id }: { id: string }) {
  const [state, action] = useActionState(() => deleteAction(id), {} as FormState);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Delete this feedback? This cannot be undone.")) e.preventDefault();
      }}
      className="space-y-2"
    >
      <Submit className="text-sm text-red-600 hover:underline disabled:opacity-50 dark:text-red-400">Delete</Submit>
      <Message state={state} />
    </form>
  );
}

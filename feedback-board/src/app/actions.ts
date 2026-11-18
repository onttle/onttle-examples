"use server";

import { updateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  FEEDBACK_TAG,
  OnttleError,
  createFeedback,
  deleteFeedback,
  feedbackTag,
  getMe,
  login,
  logout,
  resendVerification,
  signup,
  updateFeedback,
  type FeedbackInput,
} from "@/lib/onttle";
import { ACCESS_COOKIE, REFRESH_COOKIE, clearSession, withMember, writeSession } from "@/lib/session";

export interface FormState {
  error?: string;
  notice?: string;
  /** Set after sign-up, or when login says the address is not verified: shows the resend button. */
  pendingEmail?: string;
}

/** Version of the demo notice the sign-up form asks members to agree to (sent as consents). */
const CONSENT_VERSION = "2026-11-18";

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

/** Only paths inside this app: "/x", never "//host" or "https://…". */
function safeNext(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function messageFor(e: unknown): string {
  if (!(e instanceof OnttleError)) return "Something went wrong. Please try again.";
  switch (e.code) {
    case "AUTH_INVALID_CREDENTIALS":
      return "The e-mail or password is incorrect.";
    case "AUTH_EMAIL_NOT_VERIFIED":
      return "Please verify your e-mail first. Check your inbox for the link.";
    case "AUTH_EMAIL_EXISTS":
      return "This e-mail is already registered. Try logging in.";
    case "AUTH_EMAIL_WITHDRAWN":
      return "This e-mail was withdrawn recently and cannot sign up again for 90 days.";
    case "AUTH_SIGNUP_PAUSED":
      return "Sign-ups are paused for this demo right now. Please try again later.";
    case "AUTH_MEMBER_SUSPENDED":
      return "This account is suspended.";
    case "AUTH_RATE_LIMITED":
      return "Too many attempts. Please wait a minute and try again.";
    case "AUTH_FORBIDDEN":
      return "You can only edit or delete your own feedback.";
    case "AUTH_INVALID_REQUEST":
      return "Please check the fields and try again.";
  }
  if (e.status === 403) return "You can only edit or delete your own feedback.";
  if (e.status === 404) return "This feedback no longer exists.";
  if (e.status === 429) return "Too many attempts. Please wait a minute and try again.";
  if (e.status === 400) return "Please check the fields and try again.";
  return "Something went wrong. Please try again.";
}

// ---------- Sign-up, verification, login ----------

export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  const name = text(form, "name");
  const email = text(form, "email");
  const password = String(form.get("password") ?? "");

  if (!name || name.length > 40) return { error: "Enter a display name (up to 40 characters)." };
  if (!email) return { error: "Enter your e-mail." };
  if (password.length < 8 || password.length > 128) return { error: "Use a password of 8 to 128 characters." };
  if (form.get("agree") !== "on") return { error: "Please agree to the demo terms and privacy notice." };

  try {
    await signup({
      email,
      password,
      name,
      consents: [
        { type: "terms", version: CONSENT_VERSION, agreed: true },
        { type: "privacy", version: CONSENT_VERSION, agreed: true },
      ],
    });
  } catch (e) {
    return { error: messageFor(e) };
  }
  return { notice: "Almost done. We sent a verification link to your e-mail.", pendingEmail: email };
}

export async function resendAction(_: FormState, form: FormData): Promise<FormState> {
  const email = text(form, "email");
  if (!email) return { error: "Enter your e-mail." };
  try {
    await resendVerification(email);
  } catch (e) {
    return { error: messageFor(e), pendingEmail: email };
  }
  // The API answers the same for unknown addresses, so the message does not say whether it exists.
  return { notice: "If this address is waiting for verification, a new link is on its way.", pendingEmail: email };
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = text(form, "email");
  const password = String(form.get("password") ?? "");
  const next = safeNext(text(form, "next"));
  if (!email || !password) return { error: "Enter your e-mail and password." };

  try {
    const session = await login(email, password);
    writeSession(await cookies(), session);
  } catch (e) {
    const unverified = e instanceof OnttleError && e.code === "AUTH_EMAIL_NOT_VERIFIED";
    return { error: messageFor(e), pendingEmail: unverified ? email : undefined };
  }
  redirect(next);
}

export async function logoutAction() {
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;
  if (access) {
    // Revokes this login's refresh token. Local sign-out happens either way.
    await logout(access, store.get(REFRESH_COOKIE)?.value).catch(() => undefined);
  }
  clearSession(store);
  redirect("/");
}

// ---------- Feedback ----------

function readFeedback(form: FormData): FeedbackInput | string {
  const title = text(form, "title");
  const body = text(form, "body");
  const kind = text(form, "kind");
  if (!title || title.length > 100) return "Enter a title (up to 100 characters).";
  if (!body) return "Describe your feedback.";
  if (!/^[0-9a-f-]{36}$/i.test(kind)) return "Choose a type.";
  return { title, body, kind };
}

export async function createAction(_: FormState, form: FormData): Promise<FormState> {
  const input = readFeedback(form);
  if (typeof input === "string") return { error: input };

  let id: string;
  try {
    const row = await withMember("/new", async (token) => {
      // author_name is not a form field: it is the member's profile name, filled on the server.
      const me = await getMe(token);
      const name = typeof me.profile?.name === "string" && me.profile.name.trim() ? me.profile.name.trim() : "Member";
      return createFeedback(token, { ...input, author_name: name.slice(0, 40) });
    });
    id = row.id;
  } catch (e) {
    if (!(e instanceof OnttleError)) throw e; // includes the redirect to /login
    return { error: messageFor(e) };
  }

  updateTag(FEEDBACK_TAG);
  redirect(`/f/${id}`);
}

export async function updateAction(id: string, _: FormState, form: FormData): Promise<FormState> {
  const input = readFeedback(form);
  if (typeof input === "string") return { error: input };

  try {
    await withMember(`/f/${id}/edit`, (token) => updateFeedback(token, id, input));
  } catch (e) {
    if (!(e instanceof OnttleError)) throw e;
    return { error: messageFor(e) };
  }

  updateTag(FEEDBACK_TAG);
  updateTag(feedbackTag(id));
  redirect(`/f/${id}`);
}

// The second argument (previous state) comes from useActionState and is not needed here.
export async function deleteAction(id: string): Promise<FormState> {
  try {
    await withMember(`/f/${id}`, (token) => deleteFeedback(token, id));
  } catch (e) {
    if (!(e instanceof OnttleError)) throw e;
    return { error: messageFor(e) };
  }

  updateTag(FEEDBACK_TAG);
  updateTag(feedbackTag(id));
  redirect("/");
}

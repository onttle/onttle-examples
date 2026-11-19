import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Onttle webhook signature check (docs: Core features → Webhook → Verifying the Signature).
 * Header: `X-Onttle-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "{t}.{raw body}">`.
 * The body must be the text exactly as received: parsing and re-serializing it changes the bytes.
 * No Onttle call lives here, so this file has no "server-only" import and the test can load it in Node.
 */

export const TOLERANCE_SECONDS = 5 * 60;

/** Payload fields from the docs. Fields without a value are omitted (a DELETED event has no data). */
export interface WebhookPayload {
  event: "CREATED" | "UPDATED" | "DELETED";
  project_id: string;
  /** The value used in the API request path: slug or id */
  table_id: string;
  contents_id?: string;
  contents_ids?: string[];
  /** Same format as `data` in REST responses. CREATED and UPDATED only */
  data?: Record<string, unknown>;
  occurred_at: string;
}

export function verifyOnttleSignature(
  rawBody: string,
  signatureHeader: string | null,
  signingKey: string,
  nowSeconds: number = Date.now() / 1000,
): boolean {
  if (!signatureHeader || !signingKey) return false;

  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(",")) {
    const eq = part.indexOf("=");
    if (eq > 0) parts[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }

  const timestamp = Number(parts.t);
  if (!parts.t || !Number.isFinite(timestamp) || !parts.v1 || !/^[0-9a-f]+$/i.test(parts.v1)) return false;

  // Older or newer than 5 minutes: an intercepted request sent again later
  if (Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", signingKey).update(`${parts.t}.${rawBody}`).digest();
  const received = Buffer.from(parts.v1, "hex");

  // timingSafeEqual keeps the comparison time from leaking the signature
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** Builds the header the way Onttle does. Used by the test and by local curl checks with a test key. */
export function signOnttlePayload(rawBody: string, signingKey: string, timestampSeconds: number): string {
  const v1 = createHmac("sha256", signingKey).update(`${timestampSeconds}.${rawBody}`).digest("hex");
  return `t=${timestampSeconds},v1=${v1}`;
}

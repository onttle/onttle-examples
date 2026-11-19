import assert from "node:assert/strict";
import { test } from "node:test";
import { signOnttlePayload, verifyOnttleSignature } from "./webhook.ts";

// A made-up key for the test only. The real signing key lives in ONTTLE_WEBHOOK_SIGNING_KEY.
const TEST_KEY = "test-signing-key-not-a-real-one";
const NOW = 1_800_000_000;
const body = JSON.stringify({
  event: "CREATED",
  project_id: "test-project",
  table_id: "registrations",
  contents_id: "00000000-0000-4000-8000-000000000001",
  data: { event: "00000000-0000-4000-8000-000000000002" },
  occurred_at: "2027-01-15T08:00:00.000Z",
});

test("accepts a payload signed with the key", () => {
  assert.equal(verifyOnttleSignature(body, signOnttlePayload(body, TEST_KEY, NOW), TEST_KEY, NOW), true);
});

test("accepts a timestamp inside the 5-minute tolerance", () => {
  assert.equal(verifyOnttleSignature(body, signOnttlePayload(body, TEST_KEY, NOW - 299), TEST_KEY, NOW), true);
  assert.equal(verifyOnttleSignature(body, signOnttlePayload(body, TEST_KEY, NOW + 299), TEST_KEY, NOW), true);
});

test("rejects a timestamp outside the tolerance", () => {
  assert.equal(verifyOnttleSignature(body, signOnttlePayload(body, TEST_KEY, NOW - 301), TEST_KEY, NOW), false);
  assert.equal(verifyOnttleSignature(body, signOnttlePayload(body, TEST_KEY, NOW + 301), TEST_KEY, NOW), false);
});

test("rejects another key", () => {
  assert.equal(verifyOnttleSignature(body, signOnttlePayload(body, "another-key", NOW), TEST_KEY, NOW), false);
});

test("rejects a body that was parsed and serialized again", () => {
  const header = signOnttlePayload(body, TEST_KEY, NOW);
  const reserialized = JSON.stringify(JSON.parse(body), null, 2);
  assert.equal(verifyOnttleSignature(reserialized, header, TEST_KEY, NOW), false);
});

test("rejects a changed timestamp with the old signature", () => {
  const v1 = signOnttlePayload(body, TEST_KEY, NOW).split("v1=")[1];
  assert.equal(verifyOnttleSignature(body, `t=${NOW + 10},v1=${v1}`, TEST_KEY, NOW), false);
});

test("rejects missing or malformed headers", () => {
  for (const header of [null, "", "t=abc,v1=00", `t=${NOW}`, "v1=00", `t=${NOW},v1=not-hex`, `t=${NOW},v1=00`]) {
    assert.equal(verifyOnttleSignature(body, header, TEST_KEY, NOW), false);
  }
});

test("rejects everything when the signing key is empty", () => {
  assert.equal(verifyOnttleSignature(body, signOnttlePayload(body, "", NOW), "", NOW), false);
});

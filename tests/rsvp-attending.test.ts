import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAttending } from "../app/lib/rsvp-utils";
import { buildAttendingPayload, normalizeAttendingValue } from "../app/lib/rsvp-schema";

describe("attending normalization", () => {
  it("parses common truthy values", () => {
    assert.equal(parseAttending("yes"), true);
    assert.equal(parseAttending("y"), true);
    assert.equal(parseAttending("1"), true);
    assert.equal(parseAttending(true), true);
  });

  it("parses common falsey values", () => {
    assert.equal(parseAttending("no"), false);
    assert.equal(parseAttending("n"), false);
    assert.equal(parseAttending("0"), false);
    assert.equal(parseAttending(false), false);
  });

  it("normalizes RSVP table values", () => {
    assert.equal(normalizeAttendingValue("Yes"), true);
    assert.equal(normalizeAttendingValue("No"), false);
    assert.equal(normalizeAttendingValue("maybe"), null);
  });

  it("builds payload for attending column", () => {
    assert.deepEqual(buildAttendingPayload(true, "attending"), { attending: true });
    assert.deepEqual(buildAttendingPayload(false, "Yes/No"), { "Yes/No": "No" });
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAttending } from "../app/lib/rsvp-utils";
import { buildInsertPayload, normalizeAttending } from "../app/lib/rsvp/schema";

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
    assert.equal(normalizeAttending("Yes"), true);
    assert.equal(normalizeAttending("No"), false);
    assert.equal(normalizeAttending("maybe"), null);
  });

  it("builds payload for attending column", () => {
    assert.deepEqual(buildInsertPayload({ name: "Test", attending: true }, "attending"), {
      Name: "Test",
      attending: true,
    });
    assert.deepEqual(buildInsertPayload({ name: "Test", attending: false }, "legacy"), {
      Name: "Test",
      "Yes/No": "No",
    });
  });
});

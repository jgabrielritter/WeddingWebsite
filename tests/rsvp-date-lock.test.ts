import { describe, it } from "node:test";
import assert from "node:assert";
import { getRsvpCloseInfo } from "../app/lib/rsvp-utils";

describe("getRsvpCloseInfo", () => {
  it("returns open when no close date", () => {
    const info = getRsvpCloseInfo(null, new Date("2026-01-01T00:00:00Z"));
    assert.equal(info.closed, false);
    assert.equal(info.closeAt, null);
  });

  it("returns closed when now is after close date", () => {
    const info = getRsvpCloseInfo(
      "2026-01-01T00:00:00Z",
      new Date("2026-01-02T00:00:00Z")
    );
    assert.equal(info.closed, true);
  });

  it("returns open when now is before close date", () => {
    const info = getRsvpCloseInfo(
      "2026-01-10T00:00:00Z",
      new Date("2026-01-02T00:00:00Z")
    );
    assert.equal(info.closed, false);
  });
});

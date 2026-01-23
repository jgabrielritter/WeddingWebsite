import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/rsvp/route";
import { setTestSupabaseClient } from "../app/lib/rsvp-supabase";

describe("/api/rsvp", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.RSVP_ATTENDING_COLUMN = "attending";
    process.env.RSVP_EMAIL_COLUMN = "email";
    process.env.RSVP_TABLE = "RSVP";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setTestSupabaseClient(null);
  });

  it("returns 400 for invalid payload", async () => {
    const request = new Request("http://localhost/api/rsvp", {
      method: "POST",
      body: JSON.stringify({ name: "", attending: true, email: "test@example.com" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    assert.equal(response.status, 400);
    const json = await response.json();
    assert.equal(json.ok, false);
    assert.equal(json.step, "validate");
  });

  it("returns ok for valid payload with mocked supabase", async () => {
    const mockClient = {
      from: () => ({
        insert: () => ({
          select: () => ({
            maybeSingle: async () => ({ data: { id: "mock-id" }, error: null }),
          }),
        }),
      }),
    };
    setTestSupabaseClient(mockClient as any);

    const request = new Request("http://localhost/api/rsvp", {
      method: "POST",
      body: JSON.stringify({
        name: "Test User",
        attending: true,
        email: "test@example.com",
        language: "en",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.ok, true);
    assert.equal(json.insertedId, "mock-id");
  });
});

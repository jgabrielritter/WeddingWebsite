import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { handler as rsvpHandler } from "../netlify/functions/rsvp";
import { handler as healthHandler } from "../netlify/functions/rsvp-health";
import {
  getNetlifyClientIp,
} from "../app/lib/rsvp/netlify-utils";
import { buildInsertPayload } from "../app/lib/rsvp/schema";
import { setTestSupabaseClient } from "../app/lib/rsvp-supabase";

describe("Netlify RSVP handlers", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.RSVP_ATTENDING_COLUMN = "attending";
    process.env.RSVP_EMAIL_COLUMN = "email";
    process.env.RSVP_TABLE = "RSVP";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setTestSupabaseClient(null);
  });

  it("prefers the Netlify client IP header", () => {
    assert.equal(
      getNetlifyClientIp({
        "x-nf-client-connection-ip": "203.0.113.5",
        "x-forwarded-for": "198.51.100.1",
      }),
      "203.0.113.5"
    );
  });

  it("builds insert payloads with the correct columns", () => {
    assert.deepEqual(
      buildInsertPayload({ name: "Test", attending: true, email: "a@b.com" }, "attending"),
      { Name: "Test", email: "a@b.com", attending: true }
    );
    assert.deepEqual(buildInsertPayload({ name: "Test", attending: false }, "legacy"), {
      Name: "Test",
      "Yes/No": "No",
    });
  });

  it("blocks honeypot submissions", () => {
    const payload = {
      name: "Bot User",
      attending: true,
      email: "bot@example.com",
      website: "spam",
      formStartTs: Date.now() - 2000,
    };
    return rsvpHandler({
      httpMethod: "POST",
      headers: { "x-nf-client-connection-ip": "203.0.113.88" },
      body: JSON.stringify(payload),
    }).then((response) => {
      assert.equal(response.statusCode, 400);
    });
  });

  it("blocks timing trap submissions", async () => {
    const payload = {
      name: "Fast User",
      attending: true,
      email: "fast@example.com",
      formStartTs: Date.now(),
    };
    const response = await rsvpHandler({
      httpMethod: "POST",
      headers: { "x-nf-client-connection-ip": "203.0.113.89" },
      body: JSON.stringify(payload),
    });
    assert.equal(response.statusCode, 429);
  });

  it("rate limits after the configured threshold", async () => {
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

    const payload = {
      name: "Test User",
      attending: true,
      email: "test@example.com",
      formStartTs: Date.now() - 2000,
    };

    const event = {
      httpMethod: "POST",
      headers: { "x-nf-client-connection-ip": "198.51.100.10" },
      body: JSON.stringify(payload),
    };

    let lastStatus = 200;
    for (let i = 0; i < 11; i += 1) {
      const response = await rsvpHandler(event);
      lastStatus = response.statusCode;
    }

    assert.equal(lastStatus, 429);
  });

  it("returns a safe error payload for health checks", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await healthHandler({ httpMethod: "GET" });
    assert.equal(response.statusCode, 500);
    const json = JSON.parse(response.body);
    assert.equal(json.ok, false);
    assert.equal(typeof json.traceId, "string");
    assert.equal("error" in json, false);
    assert.equal("message" in json, false);
  });
});

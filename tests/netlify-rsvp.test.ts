import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handleRsvp } from "../netlify/functions/rsvp.ts";

function readBody(response: { body: string }) {
  return JSON.parse(response.body) as Record<string, any>;
}

describe("netlify/functions/rsvp handleRsvp", () => {
  it("returns ok for a valid payload when insert succeeds", async () => {
    let insertCalled = false;
    const response = await handleRsvp(
      {
        name: "Test User",
        attending: true,
        email: "test@example.com",
        formStartTs: Date.now() - 2_000,
      },
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      },
      console,
      {
        insertRsvp: async () => {
          insertCalled = true;
          return { id: "mock-id" };
        },
        sendEmail: async () => undefined,
      }
    );

    const body = readBody(response);
    assert.equal(response.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.insertedId, "mock-id");
    assert.equal(insertCalled, true);
  });

  it("returns 400 for invalid payload", async () => {
    const response = await handleRsvp(
      { name: "", attending: true },
      {},
      console,
      { insertRsvp: async () => ({ id: "unused" }) }
    );

    const body = readBody(response);
    assert.equal(response.statusCode, 400);
    assert.equal(body.ok, false);
    assert.equal(body.message, "Name is required");
    assert.equal(typeof body.traceId, "string");
  });

  it("returns ok and does not insert for honeypot payload", async () => {
    let insertCalled = false;
    const response = await handleRsvp(
      {
        name: "Bot User",
        attending: true,
        website: "https://spam.example",
        formStartTs: Date.now() - 2_000,
      },
      {},
      console,
      {
        insertRsvp: async () => {
          insertCalled = true;
          return { id: "should-not-happen" };
        },
      }
    );

    const body = readBody(response);
    assert.equal(response.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(insertCalled, false);
  });


  it("returns 500 when service role key is missing (anon fallback disabled)", async () => {
    const response = await handleRsvp(
      {
        name: "Test User",
        attending: true,
        formStartTs: Date.now() - 2_000,
      },
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_ANON_KEY: "anon-key",
      },
      console
    );

    const body = readBody(response);
    assert.equal(response.statusCode, 500);
    assert.equal(body.ok, false);
    assert.equal(body.message, "Server misconfigured");
    assert.equal(typeof body.traceId, "string");
  });

  it("returns 500 with safe message and traceId when env is missing", async () => {
    const response = await handleRsvp(
      {
        name: "Test User",
        attending: true,
        formStartTs: Date.now() - 2_000,
      },
      {},
      console
    );

    const body = readBody(response);
    assert.equal(response.statusCode, 500);
    assert.equal(body.ok, false);
    assert.equal(body.message, "Server is missing configuration.");
    assert.equal(typeof body.traceId, "string");
  });
});

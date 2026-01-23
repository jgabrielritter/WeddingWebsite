import crypto from "crypto";
import { createRsvpClient } from "../../app/lib/rsvp-supabase";
import { sendRsvpConfirmationEmail } from "../../app/lib/email";
import {
  buildInsertPayload,
  getRsvpSchemaConfig,
} from "../../app/lib/rsvp/schema";
import {
  getRsvpCloseInfo,
  isValidEmail,
  parseAttending,
} from "../../app/lib/rsvp-utils";
import {
  consumeRateLimit,
  getNetlifyClientIp,
  isHoneypotTripped,
  isTimingTrapTripped,
} from "../../app/lib/rsvp/netlify-utils";

type HandlerEvent = {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  body: string | null;
  isBase64Encoded?: boolean;
};

type HandlerResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
};

type Handler = (event: HandlerEvent) => Promise<HandlerResponse>;

function jsonResponse(statusCode: number, payload: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(payload),
  };
}

function parseJsonBody(event: HandlerEvent): { ok: true; value: any } | { ok: false } {
  if (!event.body) {
    return { ok: false };
  }
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf-8")
    : event.body;
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

export const handler: Handler = async (event) => {
  const traceId = crypto.randomUUID();
  const startedAt = Date.now();

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { ok: false, traceId, error: "Method not allowed" });
  }

  const parsed = parseJsonBody(event);
  if (!parsed.ok) {
    console.warn("[RSVP PARSE FAILED]", { traceId, step: "parse" });
    return jsonResponse(400, { ok: false, traceId, error: "Invalid JSON body" });
  }

  const body = parsed.value ?? {};
  const name = (body?.name ?? "").trim();
  const attending = parseAttending(body?.attending);
  const email = (body?.email ?? "").trim();
  const language = body?.language ?? null;
  const honeypot = (body?.website ?? "").trim();
  const formStart = Number(body?.formStartTs ?? body?.formStart ?? 0);
  const now = Date.now();

  if (isHoneypotTripped(honeypot)) {
    console.warn("[RSVP BOT BLOCKED]", { traceId, step: "honeypot" });
    return jsonResponse(400, { ok: false, traceId, error: "Submission rejected" });
  }

  if (isTimingTrapTripped(formStart, now, 800)) {
    console.warn("[RSVP BOT BLOCKED]", { traceId, step: "timing" });
    return jsonResponse(429, { ok: false, traceId, error: "Submission rejected" });
  }

  const ip = getNetlifyClientIp(event.headers ?? {});
  const rate = await consumeRateLimit(`rsvp:${ip}`, 10, 60_000, { now });
  if (!rate.allowed) {
    console.warn("[RSVP RATE LIMITED]", {
      traceId,
      step: "rate-limit",
      ip,
      resetAt: rate.resetAt,
      source: rate.source,
    });
    return {
      statusCode: 429,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": "60",
      },
      body: JSON.stringify({ ok: false, traceId, error: "Too many requests" }),
    };
  }

  if (!name) {
    return jsonResponse(400, { ok: false, traceId, error: "Name is required" });
  }

  if (attending === null) {
    return jsonResponse(400, { ok: false, traceId, error: "Attending is required" });
  }

  if (!email || !isValidEmail(email)) {
    return jsonResponse(400, { ok: false, traceId, error: "Valid email is required" });
  }

  if (name.length > 200) {
    return jsonResponse(400, { ok: false, traceId, error: "Name is too long" });
  }

  if (email.length > 254) {
    return jsonResponse(400, { ok: false, traceId, error: "Email is too long" });
  }

  const { closeAt, closed } = getRsvpCloseInfo(process.env.RSVP_CLOSE_AT);
  if (closed) {
    return jsonResponse(403, { ok: false, traceId, error: "RSVPs are closed" });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return jsonResponse(500, { ok: false, traceId, error: "Server misconfigured" });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return jsonResponse(500, { ok: false, traceId, error: "Server misconfigured" });
  }

  const { table, attendingColumn, emailColumn, nameColumn, writeMode } =
    getRsvpSchemaConfig();
  const supabase = createRsvpClient(supabaseUrl, serviceRoleKey);
  const payload = buildInsertPayload(
    { name, attending, email },
    writeMode,
    { nameColumn, attendingColumn, emailColumn }
  );

  const { data: inserted, error: insertError } = await supabase
    .from(table)
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (insertError) {
    const isRls =
      insertError.message?.toLowerCase().includes("permission denied") ||
      insertError.message?.toLowerCase().includes("row-level security");
    console.error("[RSVP INSERT FAILED]", {
      traceId,
      step: "insert",
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
    });
    return jsonResponse(500, {
      ok: false,
      traceId,
      error: isRls ? "Insert blocked by row-level security" : "Insert failed",
    });
  }

  if (process.env.RSVP_DEBUG === "true") {
    console.info("[RSVP INSERT OK]", {
      traceId,
      table,
      insertedId: inserted?.id ?? null,
      durationMs: Date.now() - startedAt,
    });
  }

  try {
    const receivedAt = new Date();
    await sendRsvpConfirmationEmail({
      to: email,
      name,
      attending,
      receivedAt,
      traceId,
      language,
    });
  } catch (error) {
    console.warn("[RSVP EMAIL WARNING]", { traceId, step: "email", error });
  }

  return jsonResponse(200, {
    ok: true,
    traceId,
    insertedId: inserted?.id ?? null,
    closeAt: closeAt ? closeAt.toISOString() : null,
  });
};

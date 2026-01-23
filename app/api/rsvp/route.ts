import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  formatDisplayDate,
  getRsvpCloseInfo,
  isValidEmail,
  parseAttending,
} from "../../lib/rsvp-utils";
import { sendRsvpConfirmationEmail } from "../../lib/email";
import {
  buildAttendingPayload,
  getRsvpSchemaConfig,
} from "../../lib/rsvp-schema";
import { consumeRateLimit, getClientIp } from "../../lib/rate-limit";
import { createRsvpClient } from "../../lib/rsvp-supabase";

export async function POST(req: Request) {
  const traceId = crypto.randomUUID();
  const debug = process.env.RSVP_DEBUG === "true";
  const startedAt = Date.now();

  try {
    let body: any;
    try {
      body = await req.json();
    } catch (error) {
      console.warn("[RSVP PARSE FAILED]", { traceId, step: "parse", error });
      return NextResponse.json(
        { ok: false, traceId, step: "parse", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const name = (body?.name ?? "").trim();
    const attending = parseAttending(body?.attending);
    const email = (body?.email ?? "").trim();
    const language = body?.language ?? null;
    const honeypot = (body?.website ?? "").trim();
    const formStart = Number(body?.formStart ?? 0);
    const now = Date.now();

    if (honeypot) {
      console.warn("[RSVP BOT BLOCKED]", { traceId, step: "honeypot" });
      return NextResponse.json(
        { ok: false, traceId, step: "honeypot", message: "Submission rejected" },
        { status: 400 }
      );
    }

    if (formStart && now - formStart < 1500) {
      console.warn("[RSVP BOT BLOCKED]", { traceId, step: "timing" });
      return NextResponse.json(
        { ok: false, traceId, step: "timing", message: "Submission rejected" },
        { status: 429 }
      );
    }

    const ip = getClientIp(req);
    const rate = consumeRateLimit(`rsvp:${ip}`, 10, 60_000, now);
    if (!rate.allowed) {
      console.warn("[RSVP RATE LIMITED]", {
        traceId,
        step: "rate-limit",
        ip,
        resetAt: rate.resetAt,
      });
      return NextResponse.json(
        { ok: false, traceId, step: "rate-limit", message: "Too many requests" },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    if (!name) {
      return NextResponse.json(
        { ok: false, traceId, step: "validate", message: "Name is required" },
        { status: 400 }
      );
    }

    if (attending === null) {
      return NextResponse.json(
        { ok: false, traceId, step: "validate", message: "Attending is required" },
        { status: 400 }
      );
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, traceId, step: "validate", message: "Valid email is required" },
        { status: 400 }
      );
    }

    if (name.length > 200) {
      return NextResponse.json(
        { ok: false, traceId, step: "validate", message: "Name is too long" },
        { status: 400 }
      );
    }

    if (email.length > 254) {
      return NextResponse.json(
        { ok: false, traceId, step: "validate", message: "Email is too long" },
        { status: 400 }
      );
    }

    const { closeAt, closed } = getRsvpCloseInfo(process.env.RSVP_CLOSE_AT);
    if (closed) {
      return NextResponse.json(
        { ok: false, traceId, step: "validate", message: "RSVPs are closed" },
        { status: 403 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.json(
        { ok: false, traceId, step: "env", message: "Missing SUPABASE URL" },
        { status: 500 }
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        {
          ok: false,
          traceId,
          step: "env",
          message: "Missing SUPABASE_SERVICE_ROLE_KEY",
        },
        { status: 500 }
      );
    }

    const { table, attendingColumn, emailColumn } = getRsvpSchemaConfig();
    const supabase = createRsvpClient(supabaseUrl, serviceRoleKey);

    const payload = {
      Name: name,
      ...(emailColumn ? { [emailColumn]: email } : {}),
      ...buildAttendingPayload(attending, attendingColumn),
    };

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
      return NextResponse.json(
        {
          ok: false,
          traceId,
          step: "insert",
          message: isRls
            ? "Insert blocked by row-level security"
            : "Insert failed",
        },
        { status: 500 }
      );
    }

    if (debug) {
      console.info("[RSVP INSERT OK]", {
        traceId,
        table,
        insertedId: inserted?.id ?? null,
        durationMs: Date.now() - startedAt,
      });
    }

    const receivedAt = new Date();
    let emailResult = { status: "skipped" as const };
    try {
      emailResult = await sendRsvpConfirmationEmail({
        to: email,
        name,
        attending,
        receivedAt,
        traceId,
        language,
      });
    } catch (error) {
      console.warn("[RSVP EMAIL WARNING]", { traceId, step: "email", error });
      emailResult = { status: "failed" as const };
    }

    if (emailResult.status === "failed") {
      console.warn("[RSVP EMAIL WARNING]", {
        traceId,
        provider: "provider" in emailResult ? emailResult.provider : undefined,
        error: "error" in emailResult ? emailResult.error : undefined,
      });
    }

    return NextResponse.json({
      ok: true,
      traceId,
      insertedId: inserted?.id ?? null,
      emailStatus: emailResult.status,
      closeAt: closeAt ? formatDisplayDate(closeAt, process.env.RSVP_TIMEZONE) : null,
    });
  } catch (e) {
    console.error("[RSVP EXCEPTION]", { traceId, step: "exception", error: e });
    return NextResponse.json(
      { ok: false, traceId, step: "exception", message: "Unexpected error" },
      { status: 500 }
    );
  }
}

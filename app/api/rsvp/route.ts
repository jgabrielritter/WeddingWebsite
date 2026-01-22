import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import {
  formatDisplayDate,
  getRsvpCloseInfo,
  isValidEmail,
  parseAttending,
} from "../../lib/rsvp-utils";
import { sendRsvpConfirmationEmail } from "../../lib/email";

export async function POST(req: Request) {
  const traceId = crypto.randomUUID();
  const debug = process.env.RSVP_DEBUG === "true";

  try {
    let body: any;
    try {
      body = await req.json();
    } catch (error) {
      console.warn("[RSVP PARSE FAILED]", { traceId, error });
      return NextResponse.json(
        { ok: false, traceId, step: "parse", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const name = (body?.name ?? "").trim();
    const attending = parseAttending(body?.attending);
    const email = (body?.email ?? "").trim();
    const language = body?.language ?? null;

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

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    const table = process.env.RSVP_TABLE ?? "RSVP";

    const payload = {
      Name: name,
      "Yes/No": attending ? "Yes" : "No",
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
      console.warn("[RSVP EMAIL WARNING]", { traceId, error });
      emailResult = { status: "failed" as const };
    }

    if (emailResult.status === "failed") {
      console.warn("[RSVP EMAIL WARNING]", {
        traceId,
        email,
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
    console.error("[RSVP EXCEPTION]", { traceId, error: e });
    return NextResponse.json(
      { ok: false, traceId, step: "exception", message: "Unexpected error" },
      { status: 500 }
    );
  }
}

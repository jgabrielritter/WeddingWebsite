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
    const body = await req.json();

    const name = (body?.name ?? "").trim();
    const attending = parseAttending(body?.attending);
    const email = (body?.email ?? "").trim();
    const language = body?.language ?? null;

    if (!name) {
      return NextResponse.json(
        { ok: false, traceId, error: "Name is required" },
        { status: 400 }
      );
    }

    if (attending === null) {
      return NextResponse.json(
        { ok: false, traceId, error: "Attending is required" },
        { status: 400 }
      );
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, traceId, error: "Valid email is required" },
        { status: 400 }
      );
    }

    const { closeAt, closed } = getRsvpCloseInfo(process.env.RSVP_CLOSE_AT);
    if (closed) {
      return NextResponse.json(
        { ok: false, traceId, error: "RSVPs are closed" },
        { status: 403 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    const table = process.env.RSVP_TABLE ?? "RSVP";

    const payload = {
      Name: name,
      attending,
      email,
    };

    const { data: inserted, error: insertError } = await supabase
      .from(table)
      .insert(payload)
      .select("id")
      .maybeSingle();

    if (insertError) {
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
          error: "Insert failed",
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
    console.error("[RSVP EXCEPTION]", e);
    return NextResponse.json(
      { ok: false, traceId, step: "exception", message: String(e) },
      { status: 500 }
    );
  }
}

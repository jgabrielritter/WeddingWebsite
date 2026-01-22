import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function POST(req: Request) {
  const traceId = crypto.randomUUID();
  const debug = process.env.RSVP_DEBUG === "true";

  try {
    const body = await req.json();

    const name = (body?.name ?? "").trim();
    const attendingRaw = body?.attending;

    const attending =
      typeof attendingRaw === "string"
        ? attendingRaw.toLowerCase().includes("y")
        : Boolean(attendingRaw);

    if (!name) {
      return NextResponse.json(
        { ok: false, traceId, error: "Name is required" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

    const { data: latest, error: readError } = await supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    if (readError) {
      console.warn("[RSVP READBACK WARNING]", { traceId, readError });
    } else if (debug) {
      console.info("[RSVP READBACK OK]", {
        traceId,
        latestId: latest?.[0]?.id ?? null,
      });
    }

    return NextResponse.json({
      ok: true,
      traceId,
      step: readError ? "insert_ok_read_warn" : "insert_ok_read_ok",
      insertedId: inserted?.id ?? null,
    });
  } catch (e) {
    console.error("[RSVP EXCEPTION]", e);
    return NextResponse.json(
      { ok: false, traceId, step: "exception", message: String(e) },
      { status: 500 }
    );
  }
}

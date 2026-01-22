import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { getRsvpCloseInfo } from "../../../lib/rsvp-utils";

export async function GET() {
  const traceId = crypto.randomUUID();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.json(
      { ok: false, traceId, step: "env", message: "Missing SUPABASE URL" },
      { status: 500 }
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!serviceRoleKey && !anonKey) {
    return NextResponse.json(
      {
        ok: false,
        traceId,
        step: "env",
        message: "Missing Supabase credentials",
      },
      { status: 500 }
    );
  }

  const supabase = createClient(
    supabaseUrl,
    serviceRoleKey ?? anonKey!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabase
    .from(process.env.RSVP_TABLE ?? "RSVP")
    .select("id")
    .limit(1);

  if (error) {
    return NextResponse.json(
      { ok: false, traceId, step: "select", message: error.message },
      { status: 500 }
    );
  }

  const { closeAt, closed } = getRsvpCloseInfo(process.env.RSVP_CLOSE_AT);

  return NextResponse.json({
    ok: true,
    traceId,
    rowCount: data?.length ?? 0,
    closed,
    closeAt: closeAt ? closeAt.toISOString() : null,
  });
}

import { NextResponse } from "next/server";
import crypto from "crypto";
import { getRsvpCloseInfo } from "../../../lib/rsvp-utils";
import { getRsvpSchemaConfig } from "../../../lib/rsvp-schema";
import { createRsvpClient } from "../../../lib/rsvp-supabase";

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

  const supabase = createRsvpClient(supabaseUrl, serviceRoleKey ?? anonKey!);
  const { table } = getRsvpSchemaConfig();

  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });

  if (error) {
    console.error("[RSVP HEALTH FAILED]", { traceId, step: "select", error });
    return NextResponse.json(
      { ok: false, traceId, step: "select", message: "Health check failed" },
      { status: 500 }
    );
  }

  const { closeAt, closed } = getRsvpCloseInfo(process.env.RSVP_CLOSE_AT);

  return NextResponse.json({
    ok: true,
    traceId,
    rowCount: count ?? 0,
    closed,
    closeAt: closeAt ? closeAt.toISOString() : null,
  });
}

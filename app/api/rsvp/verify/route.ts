import { NextResponse } from "next/server";
import crypto from "crypto";
import { createRsvpClient } from "../../../lib/rsvp-supabase";
import {
  buildInsertPayload,
  getRsvpSchemaConfig,
} from "../../../lib/rsvp/schema";

export async function POST() {
  const traceId = crypto.randomUUID();
  if (process.env.RSVP_DEBUG !== "true") {
    return NextResponse.json(
      { ok: false, traceId, step: "debug", message: "Not found" },
      { status: 404 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, traceId, step: "env", message: "Missing Supabase config" },
      { status: 500 }
    );
  }

  const { table, attendingColumn, writeMode, nameColumn } = getRsvpSchemaConfig();
  const supabase = createRsvpClient(supabaseUrl, serviceRoleKey);
  const payload = buildInsertPayload(
    { name: "Debug Probe", attending: false },
    writeMode,
    { nameColumn, attendingColumn }
  );

  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[RSVP VERIFY FAILED]", { traceId, step: "insert", error });
    return NextResponse.json(
      { ok: false, traceId, step: "insert", message: "Probe insert failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, traceId, insertedId: data?.id ?? null });
}

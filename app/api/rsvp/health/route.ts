import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabase
    .from(process.env.RSVP_TABLE ?? "RSVP")
    .select("id")
    .limit(1);

  if (error) {
    return NextResponse.json(
      { ok: false, step: "select", message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    rowCount: data?.length ?? 0,
  });
}

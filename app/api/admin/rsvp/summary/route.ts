import { NextResponse } from "next/server";
import { createServiceClient, getRsvpSummary } from "../../../../lib/admin-rsvp";
import { isAdminAuthorized } from "../../../../lib/admin-auth";

export async function GET(req: Request) {
  const auth = isAdminAuthorized(req.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      {
        status: 401,
        headers: { "WWW-Authenticate": "Basic" },
      }
    );
  }

  try {
    const supabase = createServiceClient();
    const summary = await getRsvpSummary(supabase);
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error("[ADMIN RSVP SUMMARY FAILED]", error);
    return NextResponse.json(
      { ok: false, error: "Summary failed" },
      { status: 500 }
    );
  }
}

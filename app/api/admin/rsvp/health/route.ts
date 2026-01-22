import { NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/admin-rsvp";
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

    return NextResponse.json({ ok: true, rowCount: data?.length ?? 0 });
  } catch (error) {
    console.error("[ADMIN RSVP HEALTH FAILED]", error);
    return NextResponse.json(
      { ok: false, error: "Health check failed" },
      { status: 500 }
    );
  }
}

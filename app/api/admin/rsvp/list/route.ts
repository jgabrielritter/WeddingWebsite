import { NextResponse } from "next/server";
import { createServiceClient, getRsvpList } from "../../../../lib/admin-rsvp";
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

  const { searchParams } = new URL(req.url);
  const limitRaw = Number(searchParams.get("limit") ?? 100);
  const offsetRaw = Number(searchParams.get("offset") ?? 0);
  const limit = Math.min(Number.isNaN(limitRaw) ? 100 : limitRaw, 500);
  const offset = Math.max(Number.isNaN(offsetRaw) ? 0 : offsetRaw, 0);

  try {
    const supabase = createServiceClient();
    const rows = await getRsvpList(supabase, limit, offset);
    return NextResponse.json({ ok: true, rows, limit, offset });
  } catch (error) {
    console.error("[ADMIN RSVP LIST FAILED]", error);
    return NextResponse.json(
      { ok: false, error: "List failed" },
      { status: 500 }
    );
  }
}

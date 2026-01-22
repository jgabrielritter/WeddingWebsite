import { NextResponse } from "next/server";
import { createServiceClient, getAllRsvps } from "../../../../lib/admin-rsvp";
import { rowsToCsv } from "../../../../lib/csv";
import { isAdminAuthorized } from "../../../../lib/admin-auth";

export async function GET(req: Request) {
  const auth = isAdminAuthorized(req.headers.get("authorization"));
  if (!auth.ok) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": "Basic" },
    });
  }

  try {
    const supabase = createServiceClient();
    const rows = await getAllRsvps(supabase);
    const csv = rowsToCsv(
      rows.map((row) => ({
        id: row.id,
        created_at: row.created_at,
        Name: row.Name,
        attending:
          row.attending === null ? "" : row.attending ? "Yes" : "No",
      })),
      ["id", "created_at", "Name", "attending"],
      ["id", "created_at", "Name", "attending"]
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=rsvp_export.csv",
      },
    });
  } catch (error) {
    console.error("[ADMIN RSVP EXPORT FAILED]", error);
    return new NextResponse("Export failed", { status: 500 });
  }
}

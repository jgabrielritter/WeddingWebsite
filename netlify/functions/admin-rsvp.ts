import crypto from "crypto";
import {
  createServiceClient,
  getAllRsvps,
  getRsvpList,
  getRsvpSummary,
} from "../../app/lib/admin-rsvp";
import { rowsToCsv } from "../../app/lib/csv";

type HandlerEvent = {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined>;
};

type HandlerResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
};

type Handler = (event: HandlerEvent) => Promise<HandlerResponse>;

function jsonResponse(statusCode: number, payload: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(payload),
  };
}

function isAuthorized(headers: Record<string, string | undefined>): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return false;
  }
  const auth = headers.authorization ?? headers.Authorization;
  if (!auth) {
    return false;
  }
  const [scheme, token] = auth.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return false;
  }
  return token === secret;
}

function parseLimit(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
}

export const handler: Handler = async (event) => {
  const traceId = crypto.randomUUID();

  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { ok: false, traceId, error: "Method not allowed" });
  }

  if (!isAuthorized(event.headers ?? {})) {
    return {
      statusCode: 401,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "WWW-Authenticate": "Bearer",
      },
      body: JSON.stringify({ ok: false, traceId, error: "Unauthorized" }),
    };
  }

  const action = event.queryStringParameters?.action ?? "summary";

  try {
    const supabase = createServiceClient();

    if (action === "summary") {
      const summary = await getRsvpSummary(supabase);
      return jsonResponse(200, { ok: true, summary, traceId });
    }

    if (action === "list") {
      const limitRaw = parseLimit(event.queryStringParameters?.limit, 100);
      const offsetRaw = parseLimit(event.queryStringParameters?.offset, 0);
      const limit = Math.min(Math.max(limitRaw, 1), 500);
      const offset = Math.max(offsetRaw, 0);
      const rows = await getRsvpList(supabase, limit, offset);
      return jsonResponse(200, { ok: true, rows, limit, offset, traceId });
    }

    if (action === "export") {
      const rows = await getAllRsvps(supabase);
      const csv = rowsToCsv(
        rows.map((row) => ({
          id: row.id,
          created_at: row.created_at,
          Name: row.Name,
          attending: row.attending === null ? "" : row.attending ? "Yes" : "No",
          email: row.email ?? "",
        })),
        ["id", "created_at", "Name", "attending", "email"],
        ["id", "created_at", "Name", "attending", "email"]
      );

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=rsvp_export.csv",
          "Cache-Control": "no-store",
        },
        body: csv,
      };
    }

    return jsonResponse(400, { ok: false, traceId, error: "Unknown action" });
  } catch (error) {
    console.error("[ADMIN RSVP FAILED]", { traceId, action, error });
    return jsonResponse(500, { ok: false, traceId, error: "Request failed" });
  }
};

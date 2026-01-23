import crypto from "crypto";
import { createRsvpClient } from "../../app/lib/rsvp-supabase";
import { getRsvpCloseInfo } from "../../app/lib/rsvp-utils";
import { getRsvpSchemaConfig } from "../../app/lib/rsvp/schema";

type HandlerEvent = {
  httpMethod: string;
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

export const handler: Handler = async (event) => {
  const traceId = crypto.randomUUID();

  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { ok: false, traceId, error: "Method not allowed" });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { ok: false, traceId });
  }

  try {
    const supabase = createRsvpClient(supabaseUrl, serviceRoleKey);
    const { table } = getRsvpSchemaConfig();

    const { data, error } = await supabase.from(table).select("id").limit(1);

    if (error) {
      console.error("[RSVP HEALTH FAILED]", {
        traceId,
        step: "select",
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return jsonResponse(500, { ok: false, traceId });
    }

    const { closeAt, closed } = getRsvpCloseInfo(process.env.RSVP_CLOSE_AT);

    return jsonResponse(200, {
      ok: true,
      traceId,
      rowCount: Array.isArray(data) ? data.length : 0,
      closed,
      closeAt: closeAt ? closeAt.toISOString() : null,
    });
  } catch (error) {
    console.error("[RSVP HEALTH FAILED]", { traceId, step: "exception", error });
    return jsonResponse(500, { ok: false, traceId });
  }
};

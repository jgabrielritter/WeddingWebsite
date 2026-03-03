import crypto from "crypto";
import {
  consumeRateLimit,
  getNetlifyClientIp,
  isHoneypotTripped,
  isTimingTrapTripped,
} from "../../app/lib/rsvp/netlify-utils.ts";

type HandlerEvent = {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  body: string | null;
  isBase64Encoded?: boolean;
};

type HandlerResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
};

type Handler = (event: HandlerEvent) => Promise<HandlerResponse>;

type Logger = Pick<typeof console, "info" | "warn" | "error">;
type InsertResult = { id?: string | number | null };
type Env = Record<string, string | undefined>;

/**
 * RSVP response contract:
 * - always JSON with { ok:boolean, traceId:string }
 * - failures also include { message:string }
 * - success may include { insertedId:string|null }
 */
function jsonResponse(statusCode: number, payload: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
    body: JSON.stringify(payload),
  };
}

function parseAttending(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["yes", "y", "true", "1"].includes(normalized)) return true;
    if (["no", "n", "false", "0"].includes(normalized)) return false;
  }
  return null;
}

function getRsvpSchemaConfig(env: Env) {
  const ATTENDING_COL = "attending";
  return {
    table: env.RSVP_TABLE ?? "RSVP",
    nameColumn: "Name",
    attendingColumn: env.RSVP_ATTENDING_COLUMN ?? ATTENDING_COL,
    legacyYesNoColumn: "Yes/No",
    emailColumn: env.RSVP_EMAIL_COLUMN === "" ? null : env.RSVP_EMAIL_COLUMN ?? "email",
    writeMode: (env.RSVP_ATTENDING_COLUMN ?? ATTENDING_COL) === ATTENDING_COL ? "attending" : "legacy",
  } as const;
}

function buildInsertPayload(
  payload: { name: string; attending: boolean; email?: string },
  schema: ReturnType<typeof getRsvpSchemaConfig>
): Record<string, string | boolean> {
  const insertPayload: Record<string, string | boolean> = {
    [schema.nameColumn]: payload.name,
  };
  if (payload.email && schema.emailColumn) {
    insertPayload[schema.emailColumn] = payload.email;
  }
  if (schema.writeMode === "attending") {
    insertPayload[schema.attendingColumn] = payload.attending;
  } else {
    insertPayload[schema.legacyYesNoColumn] = payload.attending ? "Yes" : "No";
  }
  return insertPayload;
}

function parseJsonBody(event: HandlerEvent): { ok: true; value: any } | { ok: false } {
  if (!event.body) return { ok: false };
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf-8") : event.body;
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

function normalizePayload(input: any) {
  return {
    name: String(input?.name ?? "").trim(),
    attending: parseAttending(input?.attending),
    email: String(input?.email ?? "").trim(),
    language: input?.language ?? null,
    website: String(input?.website ?? "").trim(),
    formStartTs: Number(input?.formStartTs ?? 0),
  };
}

function validatePayload(payload: ReturnType<typeof normalizePayload>): string | null {
  if (!payload.name) return "Name is required";
  if (payload.attending === null) return "Attending is required";
  if (payload.name.length > 200) return "Name is too long";
  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return "Valid email is required";
  }
  if (payload.email && payload.email.length > 254) return "Email is too long";
  return null;
}

async function getSupabaseInsert(env: Env) {
  const supabaseUrl = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const hasServiceRole = Boolean(env.SUPABASE_SERVICE_ROLE_KEY);
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_ANON_KEY;
  const keyMode = hasServiceRole ? "service_role" : env.SUPABASE_ANON_KEY ? "anon_fallback" : "missing";

  console.info("[RSVP ENV CHECK]", {
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasAnonKey: Boolean(env.SUPABASE_ANON_KEY),
    hasServiceRole,
    keyMode,
  });

  if (!supabaseUrl) throw new Error("MISSING_SUPABASE_URL");
  if (!supabaseKey) throw new Error("MISSING_SUPABASE_KEY");
  if (!hasServiceRole) throw new Error("MISSING_SUPABASE_SERVICE_ROLE_KEY");

  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  return async (table: string, payload: Record<string, unknown>) => {
    const { data, error } = await client.from(table).insert(payload).select("id").maybeSingle();
    if (error) throw error;
    return data as InsertResult | null;
  };
}

export async function handleRsvp(
  requestBody: unknown,
  env: Env,
  logger: Logger = console,
  deps?: {
    now?: () => number;
    traceId?: () => string;
    insertRsvp?: (table: string, payload: Record<string, unknown>) => Promise<InsertResult | null>;
    sendEmail?: (args: Record<string, unknown>) => Promise<void>;
  }
): Promise<HandlerResponse> {
  const traceId = deps?.traceId?.() ?? crypto.randomUUID();
  const now = deps?.now?.() ?? Date.now();
  const payload = normalizePayload(requestBody);
  const validationError = validatePayload(payload);

  logger.info("[RSVP HANDLE START]", {
    traceId,
    method: "POST",
    payload: {
      nameLength: payload.name.length,
      hasEmail: Boolean(payload.email),
      attending: payload.attending,
      hasWebsiteValue: Boolean(payload.website),
      formStartTs: payload.formStartTs,
    },
    validation: validationError ? { ok: false, reason: validationError } : { ok: true },
  });

  if (validationError) return jsonResponse(400, { ok: false, traceId, message: validationError });

  if (isHoneypotTripped(payload.website) || isTimingTrapTripped(payload.formStartTs, now, 800)) {
    logger.warn("[RSVP SPAM FILTERED]", { traceId });
    return jsonResponse(200, { ok: true, traceId });
  }

  try {
    const insertRsvp = deps?.insertRsvp ?? (await getSupabaseInsert(env));
    const schema = getRsvpSchemaConfig(env);
    const insertPayload = buildInsertPayload(
      { name: payload.name, attending: payload.attending as boolean, email: payload.email || undefined },
      schema
    );
    logger.info("[RSVP INSERT ATTEMPT]", {
      traceId,
      table: schema.table,
      insertPayload,
    });

    const inserted = await insertRsvp(
      schema.table,
      insertPayload
    );

    logger.info("[RSVP INSERT RESULT]", {
      traceId,
      insertedId: inserted?.id ?? null,
    });

    if (deps?.sendEmail && payload.email) {
      try {
        await deps.sendEmail({
          to: payload.email,
          name: payload.name,
          attending: payload.attending,
          traceId,
          language: payload.language,
        });
      } catch (error) {
        logger.warn("[RSVP EMAIL WARNING]", { traceId, error });
      }
    }

    return jsonResponse(200, { ok: true, traceId, insertedId: inserted?.id ?? null });
  } catch (error: any) {
    if (error?.message === "MISSING_SUPABASE_URL") {
      logger.error("[RSVP ENV MISSING]", { traceId, missing: "SUPABASE_URL" });
      return jsonResponse(500, { ok: false, traceId, message: "Server is missing configuration." });
    }
    if (error?.message === "MISSING_SUPABASE_KEY") {
      logger.error("[RSVP ENV MISSING]", {
        traceId,
        missing: "SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY",
      });
      return jsonResponse(500, { ok: false, traceId, message: "Server misconfigured" });
    }
    if (error?.message === "MISSING_SUPABASE_SERVICE_ROLE_KEY") {
      logger.error("[RSVP ENV MISSING]", {
        traceId,
        missing: "SUPABASE_SERVICE_ROLE_KEY",
      });
      return jsonResponse(500, { ok: false, traceId, message: "Server misconfigured" });
    }

    logger.error("[RSVP INSERT FAILED]", {
      traceId,
      table: getRsvpSchemaConfig(env).table,
      insertPayload: buildInsertPayload(
        {
          name: payload.name,
          attending: (payload.attending ?? false) as boolean,
          email: payload.email || undefined,
        },
        getRsvpSchemaConfig(env)
      ),
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });
    return jsonResponse(500, {
      ok: false,
      traceId,
      message: "We couldn’t submit your RSVP. Please try again.",
    });
  }
}

export const handler: Handler = async (event) => {
  const traceId = crypto.randomUUID();
  const ip = getNetlifyClientIp(event.headers ?? {});

  console.info("[RSVP REQUEST]", {
    traceId,
    method: event.httpMethod,
    path: "/.netlify/functions/rsvp",
    contentType: event.headers?.["content-type"] ?? event.headers?.["Content-Type"] ?? null,
  });

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { ok: false, traceId, message: "Method not allowed" });
  }

  const parsed = parseJsonBody(event);
  if (!parsed.ok) {
    return jsonResponse(400, { ok: false, traceId, message: "Invalid JSON body" });
  }

  console.info("[RSVP REQUEST BODY]", {
    traceId,
    parsedBody: parsed.value,
  });

  const rate = await consumeRateLimit(`rsvp:${ip}`, 10, 60_000, { now: Date.now() });
  if (!rate.allowed) {
    return {
      statusCode: 429,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Retry-After": "60",
      },
      body: JSON.stringify({ ok: false, traceId, message: "Too many requests" }),
    };
  }

  return handleRsvp(parsed.value, process.env, console, { traceId: () => traceId });
};

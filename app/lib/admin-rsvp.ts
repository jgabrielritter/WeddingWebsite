import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getAttendingSelectColumn,
  getRsvpSchemaConfig,
  normalizeAttendingValue,
} from "./rsvp-schema";

export type RsvpRow = {
  id: string | number;
  created_at: string;
  Name: string;
  attending: boolean | null;
  email?: string | null;
};

export type RsvpSummary = {
  total: number;
  attending: number;
  notAttending: number;
  last7Days: number;
  last30Days: number;
};

export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase service role configuration");
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function tableName() {
  return getRsvpSchemaConfig().table;
}

async function fetchCount(supabase: SupabaseClient, filters?: (query: any) => any) {
  let query = supabase.from(tableName()).select("id", { count: "exact", head: true });
  if (filters) {
    query = filters(query);
  }
  const { count, error } = await query;
  if (error) {
    throw error;
  }
  return count ?? 0;
}

export async function getRsvpSummary(supabase: SupabaseClient): Promise<RsvpSummary> {
  const now = new Date();
  const since7 = new Date(now);
  since7.setDate(now.getDate() - 7);
  const since30 = new Date(now);
  since30.setDate(now.getDate() - 30);
  const { attendingColumn } = getRsvpSchemaConfig();
  const attendingFilterValue = attendingColumn === "attending" ? true : "Yes";
  const notAttendingFilterValue = attendingColumn === "attending" ? false : "No";

  const [total, attending, notAttending, last7Days, last30Days] = await Promise.all([
    fetchCount(supabase),
    fetchCount(supabase, (query) => query.eq(attendingColumn, attendingFilterValue)),
    fetchCount(supabase, (query) => query.eq(attendingColumn, notAttendingFilterValue)),
    fetchCount(supabase, (query) => query.gte("created_at", since7.toISOString())),
    fetchCount(supabase, (query) => query.gte("created_at", since30.toISOString())),
  ]);

  return { total, attending, notAttending, last7Days, last30Days };
}

export async function getRsvpList(
  supabase: SupabaseClient,
  limit = 100,
  offset = 0
): Promise<RsvpRow[]> {
  const { attendingColumn, emailColumn } = getRsvpSchemaConfig();
  const attendingSelect = getAttendingSelectColumn(attendingColumn);
  const selectColumns = ["id", "created_at", "Name", attendingSelect];
  if (emailColumn) {
    selectColumns.push(emailColumn);
  }
  const { data, error } = await supabase
    .from(tableName())
    .select(selectColumns.join(","))
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row: any) => {
    const attendingValue =
      attendingColumn === "attending" ? row.attending : row[attendingColumn];
    return {
      id: row.id,
      created_at: row.created_at,
      Name: row.Name,
      email: emailColumn ? row[emailColumn] ?? null : null,
      attending: normalizeAttendingValue(attendingValue),
    } as RsvpRow;
  });
}

export async function getAllRsvps(supabase: SupabaseClient): Promise<RsvpRow[]> {
  const batchSize = 1000;
  let offset = 0;
  const rows: RsvpRow[] = [];

  while (true) {
    const batch = await getRsvpList(supabase, batchSize, offset);
    if (!batch.length) {
      break;
    }
    rows.push(...batch);
    if (batch.length < batchSize) {
      break;
    }
    offset += batchSize;
  }

  return rows;
}

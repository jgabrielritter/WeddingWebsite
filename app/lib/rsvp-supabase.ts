import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let testClient: SupabaseClient | null = null;

export function setTestSupabaseClient(client: SupabaseClient | null) {
  testClient = client;
}

export function createRsvpClient(url: string, key: string): SupabaseClient {
  if (testClient) {
    return testClient;
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

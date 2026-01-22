# RSVP Troubleshooting Guide

This guide explains how to troubleshoot RSVP submission failures and verify Supabase connectivity in production.

## Quick checks

1. **Browser console**
   - Open the RSVP page, submit the form, and inspect the browser console.
   - The client logs structured failure details including `status`, `statusText`, and the server JSON payload.
   - Look for `traceId`, `step`, and `message` in the response body so you can correlate server logs.

2. **Health endpoint**
   - Call `GET /api/rsvp/health` to confirm the API can reach Supabase.
   - A success response includes `{ ok: true, rowCount, traceId }`.
   - A failure response includes `{ ok: false, traceId, step, message }`.

## Server-side logging

Server logs are structured and include `traceId` values to correlate errors.

Common log entries:

- `RSVP PARSE FAILED` → invalid JSON payload
- `RSVP INSERT FAILED` → Supabase insert error (see `message`, `details`, `hint`)
- `RSVP EXCEPTION` → unexpected runtime failure

## Common error causes

### Missing environment variables

The RSVP API returns `{ step: "env" }` when configuration is missing. Ensure the following are present at runtime:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (required for secure inserts)
- `RSVP_TABLE` (optional, defaults to `RSVP`)

### Incorrect table or column names

The RSVP table is `RSVP` in the public schema with columns:

- `Name` (text)
- `Yes/No` (text)

The insert payload must be:

```ts
const payload = {
  Name: name,
  "Yes/No": attending ? "Yes" : "No",
};
```

Do not insert non-existent columns such as `attending`, `email`, or `created_at` unless your schema has been migrated.

### Row-level security (RLS)

If Supabase returns errors like:

- `permission denied`
- `new row violates row-level security policy`

then RLS is blocking inserts. The API uses the **service role key** to bypass RLS for secure inserts. Confirm that:

- The server runtime has `SUPABASE_SERVICE_ROLE_KEY` set.
- The service role key is **never** exposed to the client.

If you want to allow public anonymous inserts instead, add a public insert policy in Supabase (not recommended):

```sql
alter table public."RSVP" enable row level security;

create policy "Allow public RSVP inserts"
  on public."RSVP"
  for insert
  to anon
  with check (true);
```

## Debugging checklist

1. Submit the RSVP form and capture the `traceId` from the console log.
2. Search server logs for the same `traceId`.
3. Check `/api/rsvp/health` for connectivity.
4. Confirm table name and column names match the schema.
5. Verify environment variables in the deployment target.

## Useful curl commands

```bash
curl -i http://localhost:3000/api/rsvp/health
```

```bash
curl -i -X POST http://localhost:3000/api/rsvp \
  -H "Content-Type: application/json" \
  -d '{"name":"Joe Test","attending":"Yes","email":"joe@example.com"}'
```

# RSVP Debug Notes

## Root cause
Production RSVP inserts fail when `SUPABASE_SERVICE_ROLE_KEY` is not configured in Netlify.

The Netlify RSVP handler intentionally rejects anon-only configuration:
- it logs env presence booleans (`hasSupabaseUrl`, `hasAnonKey`, `hasServiceRole`),
- and returns `500` when service-role key is missing.

This behavior is now explicit and traceable in server logs.

## Evidence summary
- Handler validates payload and logs a request-scoped `traceId`.
- In anon-only mode, handler logs `keyMode: "anon_fallback"` and returns `500` with `message: "Server misconfigured"`.
- With service role configured, insert attempt logs include table + payload and insert result (`insertedId`).

## Fix implemented
1. Added structured diagnostics in `netlify/functions/rsvp.ts`:
   - request body logging
   - validation result logging
   - env presence booleans logging
   - insert payload logging
   - Supabase insert success/failure logging with `traceId`
2. Strengthened validation with server-side email format check.
3. Updated `netlify/functions/rsvp-health.ts` to return safe env booleans:
   - `hasSupabaseUrl`
   - `hasKey` (service role key present)
4. Updated `rsvp.html` to include `traceId` in user-facing error text when submission fails.

## Verification steps
1. Configure Netlify env vars:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - optional `RSVP_TABLE`, `RSVP_ATTENDING_COLUMN`, `RSVP_EMAIL_COLUMN`
2. Call health endpoint:
   - `GET /api/rsvp/health`
   - expect `{ "ok": true, "hasSupabaseUrl": true, "hasKey": true, ... }`
3. Submit RSVP form and verify:
   - network response `200` + `{ ok: true, traceId, insertedId }`
   - Netlify logs show `[RSVP INSERT RESULT]`
   - Supabase table has new row.

## Supabase policy approach
Implemented safer server-side insert approach using `SUPABASE_SERVICE_ROLE_KEY` on Netlify function only.
No service-role secret is exposed to the browser.

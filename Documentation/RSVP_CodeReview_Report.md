# RSVP Code Review Report

## Findings by Severity

### Critical
- **Schema mismatch risk between API insert and Supabase table**: API previously wrote to legacy `"Yes/No"` column, while migration indicates a normalized `attending` column with optional `email` column. This could lead to failed inserts or partial data. (Files: `app/api/rsvp/route.ts`, `supabase/migrations/0001_rsvp_schema_normalize.sql`)

### Major
- **Limited abuse controls**: public RSVP endpoint had no rate limiting or bot detection, increasing spam risk. (Files: `app/api/rsvp/route.ts`, `rsvp.html`)
- **Health endpoint leaked internal error messages**: Supabase errors could be returned to clients instead of a safe message with traceId. (File: `app/api/rsvp/health/route.ts`)
- **Admin summary depended on `attending` column only**: if legacy column was still in use, admin analytics and export would be inconsistent. (File: `app/lib/admin-rsvp.ts`)

### Minor
- **Accessibility polish**: missing `aria-invalid` updates and length constraints on inputs. (File: `rsvp.html`)
- **Trace ID surface in UI**: user-friendly errors did not include reference IDs for troubleshooting. (File: `rsvp.html`)

## Fixes Applied in This Patch
- Updated API inserts to use schema config with `attending` + `email`, respecting `RSVP_ATTENDING_COLUMN` overrides.
- Added rate limiting, honeypot, and timing trap for the RSVP POST route.
- Hardened `/api/rsvp/health` response to avoid exposing Supabase error text.
- Added `/api/rsvp/verify` debug endpoint gated by `RSVP_DEBUG=true`.
- Improved form validation and accessibility attributes while keeping styling intact.
- Updated admin fetch logic to normalize `attending` from either column.
- Added unit/integration tests and documentation for RSVP flows and security.

## Remaining Recommendations
- Add a distributed rate limiter (Upstash/Redis) for production scaling.
- Consider CAPTCHA or Turnstile if abuse increases.
- Consider removing the public insert policy once server-only inserts are confirmed.

## How to Verify
1. **Health check**
   - `curl -s http://localhost:3000/api/rsvp/health`
2. **Submit RSVP (valid)**
   - `curl -s -X POST http://localhost:3000/api/rsvp \
     -H 'Content-Type: application/json' \
     -d '{"name":"Test User","email":"test@example.com","attending":true}'`
3. **Submit RSVP (invalid)**
   - `curl -s -X POST http://localhost:3000/api/rsvp \
     -H 'Content-Type: application/json' \
     -d '{"name":"","email":"bad","attending":true}'`
4. **Debug verify (only if RSVP_DEBUG=true)**
   - `curl -s -X POST http://localhost:3000/api/rsvp/verify`

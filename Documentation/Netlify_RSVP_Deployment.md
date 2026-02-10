# Netlify RSVP Deployment Guide

## Runtime + Routing
- **Production handler**: Netlify Functions (`/.netlify/functions/rsvp`, `rsvp-health`, `admin-rsvp`).
- **Routing**: `netlify.toml` rewrites `/api/rsvp`, `/api/rsvp/health`, and `/api/admin/rsvp/*` to functions with `status = 200` and `force = true` so POST methods are preserved and never redirected to SPA HTML.

## Required Environment Variables

### Public (safe to expose)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL.

### Secret (server-only)
- `SUPABASE_URL` — recommended explicit server URL.
- `SUPABASE_SERVICE_ROLE_KEY` — **preferred** for server-side inserts and admin endpoints.
- `SUPABASE_ANON_KEY` — fallback only (requires RLS policy allowing inserts).
- `ADMIN_SECRET` — bearer token for admin analytics + CSV export.
- `RSVP_CLOSE_AT` — ISO8601 timestamp for RSVP close date (example: `2026-08-15T23:59:59-05:00`).
- `EMAIL_PROVIDER` — optional (e.g. `resend`) to enable confirmation email.
- `EMAIL_API_KEY` — required if email provider enabled.
- `EMAIL_FROM` — required if email provider enabled.
- `RSVP_REPLY_TO` — optional email reply-to address.
- `RSVP_TIMEZONE` — optional timezone for formatting confirmations.
- `RSVP_SITE_URL` — optional site URL included in confirmation emails.

### Optional abuse-control (distributed rate limiting)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Netlify UI Setup
1. Open **Site settings → Environment variables**.
2. Add public + secret variables as listed above.
3. Redeploy to apply new environment variables.

## Verification Commands

### Local verification (Netlify dev)
Run Netlify dev in one terminal:
```bash
netlify dev
```

Then submit a test RSVP:
```bash
curl -s -X POST http://localhost:8888/api/rsvp \
  -H "Content-Type: application/json" \
  -d '{"name":"Local Test","attending":true,"email":"local@example.com","formStartTs":1700000000000}'
```

### Production verification
```bash
curl -s -X POST https://<your-site>.netlify.app/api/rsvp \
  -H "Content-Type: application/json" \
  -d '{"name":"Prod Test","attending":true,"email":"prod@example.com","formStartTs":1700000000000}'
```

### What to check
- **Netlify Function logs** (`Functions → rsvp → logs`): find the `traceId` and verify no `ENV MISSING` or `INSERT FAILED` entries.
- **Supabase table** (`RSVP` by default): verify a new row exists and core columns are populated (`Name`, attendance column, optional email column).
- **Spam checks**: submit with non-empty `website` or very recent `formStartTs`; expect `{ "ok": true }` and no new row.

## Health Check
```bash
curl -s https://<your-site>.netlify.app/api/rsvp/health
```

## Admin Summary (Bearer Token)
```bash
curl -s https://<your-site>.netlify.app/api/admin/rsvp?action=summary \
  -H "Authorization: Bearer <ADMIN_SECRET>"
```

## Admin List + Export
```bash
curl -s "https://<your-site>.netlify.app/api/admin/rsvp?action=list&limit=50&offset=0" \
  -H "Authorization: Bearer <ADMIN_SECRET>"

curl -s "https://<your-site>.netlify.app/api/admin/rsvp?action=export" \
  -H "Authorization: Bearer <ADMIN_SECRET>" \
  -o rsvp_export.csv
```

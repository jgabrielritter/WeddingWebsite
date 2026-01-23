# Netlify RSVP Deployment Guide

## Runtime + Routing
- **Production handler**: Netlify Functions (`/.netlify/functions/rsvp`, `rsvp-health`, `admin-rsvp`).
- **Routing**: `netlify.toml` redirects `/api/rsvp`, `/api/rsvp/health`, and `/api/admin/rsvp/*` to the functions.

## Required Environment Variables

### Public (safe to expose)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL.

### Secret (server-only)
- `SUPABASE_SERVICE_ROLE_KEY` — **required** for inserts and admin endpoints.
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

## Logs + Debugging
- View logs: **Functions → View logs** in the Netlify dashboard.
- Look for trace IDs in logs when debugging RSVP submissions.

## Health Check
```bash
curl -s https://<your-site>.netlify.app/api/rsvp/health
```

## RSVP Submit (POST)
```bash
curl -s -X POST https://<your-site>.netlify.app/api/rsvp \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","attending":true,"email":"test@example.com","formStartTs":1234567890}'
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

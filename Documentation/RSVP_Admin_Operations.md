# RSVP Admin Operations

## Overview
This document explains how to operate the upgraded RSVP system, including environment configuration, admin access, exports, and email verification.

## Environment Variables

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public anon key used for RSVP form submissions.
- `SUPABASE_SERVICE_ROLE_KEY`: Server-side service role key used for admin reads and health checks.
- `RSVP_TABLE`: Optional override for the table name (defaults to `RSVP`).

### RSVP Lock
- `RSVP_CLOSE_AT`: ISO timestamp for the RSVP close date (e.g. `2026-08-15T23:59:59-05:00`).
- `RSVP_TIMEZONE`: Optional timezone for date formatting (default is `America/New_York`).

### Admin Auth (Basic Auth)
- `ADMIN_USER`: Username for admin access (defaults to `admin`).
- `ADMIN_SECRET`: Password for admin access. Required for admin endpoints and dashboard.

### Email (Resend)
- `EMAIL_PROVIDER`: Set to `resend` to enable confirmation emails.
- `EMAIL_API_KEY`: Resend API key (server-side only).
- `EMAIL_FROM`: Sender address (e.g. `Angelika & Gabe <hello@yourdomain.com>`).
- `RSVP_REPLY_TO`: Optional reply-to address.
- `RSVP_SITE_URL`: Optional link included in the confirmation email.

## Database Migrations
1. Apply `supabase/migrations/0001_rsvp_schema_normalize.sql` to add the `attending` and `email` columns, backfill data, add indexes, and enable the insert policy.
2. After verifying the deployment, you can create a follow-up migration to drop the legacy `"Yes/No"` column.

## Admin Dashboard
- URL: `/admin/rsvp`
- Protected via HTTP Basic Auth. The browser will prompt for `ADMIN_USER` + `ADMIN_SECRET`.
- Displays totals, trends (7/30 days), and recent RSVPs.
- Includes a "Download CSV" link for full export.

## Admin APIs
All admin APIs require HTTP Basic Auth.

- `GET /api/admin/rsvp/summary` → counts and recent trend totals.
- `GET /api/admin/rsvp/list?limit=100&offset=0` → recent RSVPs.
- `GET /api/admin/rsvp/export.csv` → full CSV export.
- `GET /api/admin/rsvp/health` → service role health check.

## CSV Export
- Columns: `id,created_at,Name,attending`.
- Values are properly escaped for commas and quotes.

## Confirmation Emails
- Sent after a successful RSVP insert.
- If email sending fails, the RSVP still succeeds and the API returns `emailStatus: "failed"`.

## Verification Steps
1. Submit an RSVP through `rsvp.html` and confirm the response payload includes `emailStatus`.
2. Confirm a row is written with `attending` and `email` populated.
3. Log in to `/admin/rsvp` and review totals/rows.
4. Download `/api/admin/rsvp/export.csv` and confirm data format.

## Rollback Instructions
1. Revert application code to the previous release.
2. Leave the `attending` and `email` columns in place to avoid data loss.
3. If needed, re-run a backfill for `"Yes/No"` using the data in `attending`.
4. Remove the new admin routes and middleware if you fully revert the admin features.

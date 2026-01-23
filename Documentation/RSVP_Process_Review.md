# RSVP Process Review

## Architecture Map
- **UI entrypoint(s)**
  - `rsvp.html` (primary RSVP form page).
- **Submit handler**
  - `rsvp.html` → inline `<script>` submit handler on `#rsvpForm`.
- **API route(s)**
  - `app/api/rsvp/route.ts` (POST `/api/rsvp`).
  - `app/api/rsvp/health/route.ts` (GET `/api/rsvp/health`).
  - `app/api/rsvp/verify/route.ts` (POST `/api/rsvp/verify`, debug-only).
- **Supabase client init**
  - `app/lib/rsvp-supabase.ts` and `app/lib/admin-rsvp.ts` (service role for admin endpoints).
- **Table & column mapping**
  - Table: `RSVP` (default via `RSVP_TABLE`).
  - Columns: `Name`, `attending` (preferred), legacy `"Yes/No"`, optional `email`.
  - Column configuration: `app/lib/rsvp/schema.ts`.

## User Journey (Happy Path)
1. User opens `rsvp.html` and sees the RSVP form with language selection.
2. Client checks `/api/rsvp/health` to determine availability and close date.
3. User submits name, email, and attending choice.
4. Client validates fields (presence, length, email format), disables submit, and shows a “Submitting” status.
5. POST `/api/rsvp` inserts to Supabase and optionally sends confirmation email.
6. UI shows success and resets form.

## Validation Review
- **Name**
  - Required (non-empty, trimmed).
  - Length capped at 200 characters (client + server).
- **Email**
  - Required with basic format regex.
  - Length capped at 254 characters (client + server).
- **Attending**
  - Required, normalized from `yes/no` to boolean.

## Double-Submit Behavior
- Client-side `isSubmitting` flag and disabled submit button prevent rapid double clicks.
- Server-side rate limiting and honeypot checks provide defense-in-depth.

## Network & Server Failure Modes
- **Network failure / offline**
  - Client catches errors and shows a friendly message.
- **Timeout / 5xx**
  - Client surfaces a generic failure message with trace reference when present.
- **RLS denial / missing env / schema mismatch**
  - Server returns `ok: false` with `traceId` and a safe message; detailed errors logged server-side only.

## UX & Accessibility
- Form labels are properly connected to inputs.
- Error messages are announced via `role="alert"` and `aria-live="polite"`.
- `aria-invalid` is toggled on inputs with validation errors.
- Loading state is displayed in the confirmation area and submit button is disabled during submission.
- Hidden honeypot field is excluded from the accessibility tree.

## Edge Cases
- Empty, whitespace-only, or overly long input is rejected on client and server.
- Rapid submission attempts are rate-limited on the server.
- Suspiciously fast submissions are rejected with a timing trap.
- RSVP close date is enforced on server (and reflected in UI).

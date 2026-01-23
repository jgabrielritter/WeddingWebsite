# RSVP Security Review

## Current Controls
- Server-side input validation (name, email, attending).
- Service role inserts for API routes.
- Trace IDs for server logging without leaking PII to clients.

## Added Controls
- **Rate limiting**: 10 requests/minute per IP for `/api/rsvp`.
- **Honeypot field**: hidden `website` field to flag bot submissions.
- **Timing trap**: reject submissions under 1.5 seconds from form start.

## Recommendations
- Use an edge/global rate limiter (Upstash/Redis) for production if traffic grows.
- Add CAPTCHA (Cloudflare Turnstile / reCAPTCHA) if abuse becomes persistent.
- Restrict admin endpoints to authenticated users only (already Basic Auth for admin APIs).
- Ensure CORS defaults remain restrictive if enabling cross-origin RSVP submissions.

## Notes
- The API returns `traceId` for diagnostics without exposing Supabase error details.
- Avoid logging user email/name in server logs unless necessary for debugging.

# RSVP Test Plan

## Unit Tests
- **Attending normalization**
  - `parseAttending` should accept yes/no variants and booleans.
  - `normalizeAttendingValue` should map legacy `"Yes/No"` strings to booleans.

## Integration Tests
- **API validation**
  - `/api/rsvp` returns 400 when required fields are missing.
- **API success path**
  - `/api/rsvp` returns `ok: true` for a valid payload when Supabase is mocked.

## Suggested E2E (Optional)
- Use Playwright to load `rsvp.html`, fill the form, submit, and confirm success state.

## How to Run (Node Test Runner)
- `node --test`

## CI Recommendations
- Add `node --test` to CI to cover RSVP validation and normalization tests.
- Add optional Playwright E2E job for full UI flow when frontend is deployed.

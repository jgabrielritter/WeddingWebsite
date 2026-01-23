# RSVP RLS Review

## Current State
- Migration `supabase/migrations/0001_rsvp_schema_normalize.sql` enables RLS on `public."RSVP"` and creates a **public insert** policy requiring non-empty `"Name"` and non-null `attending`.
- Server code uses the **service role key** for inserts and admin operations, bypassing RLS where needed.

## Risk Assessment
- **Medium risk** if public insert is enabled and the API is publicly accessible without rate limiting or bot controls.
- **Lower risk** when inserts are performed only with a service role key and the public insert policy is removed or locked down.

## Recommended Policy Pattern
1. **Server-only inserts (preferred):**
   - Remove/disable public insert policy.
   - Ensure API uses service role key (current `/api/rsvp` does).

2. **If public insert must remain:**
   - Strict `WITH CHECK` constraints (name length, attending required, email length).
   - Add throttling at edge or API gateway.

## SQL Snippets (server-only inserts)
```sql
-- Disable public insert policy
DROP POLICY IF EXISTS public_rsvp_insert ON public."RSVP";

-- (Optional) Keep RLS enabled and rely on service role key
ALTER TABLE public."RSVP" ENABLE ROW LEVEL SECURITY;
```

## SQL Snippets (public insert with tighter checks)
```sql
CREATE POLICY "public_rsvp_insert"
  ON public."RSVP"
  FOR INSERT
  TO public
  WITH CHECK (
    char_length(coalesce("Name", '')) > 0
    AND char_length(coalesce("Name", '')) <= 200
    AND attending is not null
    AND char_length(coalesce(email, '')) <= 254
  );
```

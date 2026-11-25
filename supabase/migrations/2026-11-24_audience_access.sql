-- Audience tables are blocked by missing Data API grants (same pattern as
-- finance_access). RLS policies already exist as permissive public ALL;
-- restore client grants required by the publishable-key app.

grant select, insert, update, delete
  on table public.audience_contacts,
         public.audience_access_grants
  to anon, authenticated;

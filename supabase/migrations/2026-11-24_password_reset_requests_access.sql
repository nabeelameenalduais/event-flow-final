-- Password reset requests are blocked by missing Data API grants (same pattern
-- as finance/audience/campaigns/broadcast access). RLS policy already exists as
-- permissive public ALL; restore client grants required by the publishable-key app.

grant select, insert, update, delete
  on table public.password_reset_requests
  to anon, authenticated;

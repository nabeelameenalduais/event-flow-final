-- Broadcast tables are blocked by missing Data API grants (same pattern as
-- finance/audience/campaigns access). RLS policies already exist as permissive
-- public ALL; restore client grants required by the publishable-key app.

grant select, insert, update, delete
  on table public.admin_messages,
         public.admin_message_recipients
  to anon, authenticated;

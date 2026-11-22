-- Finance tables were created without Data API grants after the platform
-- stopped exposing new public tables automatically. The existing *_all RLS
-- policies already define the project's access model; restore the client
-- grants needed by the publishable-key app.

grant select, insert, update, delete
  on table public.currencies,
         public.funding_sources,
         public.expenses,
         public.fund_transfers
  to anon, authenticated;

-- Expense approval notices are sent by financeService with this type.
alter type public.notification_type add value if not exists 'expense_approval';

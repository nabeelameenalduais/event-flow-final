-- ============================================================
-- Enforce logical event dates:
--   registration_deadline <= start_date < end_date
-- Run this in the Supabase SQL Editor after the base schema.
-- ============================================================

-- Repair legacy records before adding the constraint.
-- * An event whose end is not after its start gets a one-hour duration.
-- * A registration deadline after the start is moved back to the start time.
update public.events
set end_date = case
                 when end_date <= start_date then start_date + interval '1 hour'
                 else end_date
               end,
    registration_deadline = least(registration_deadline, start_date),
    updated_at = now()
where end_date <= start_date
   or registration_deadline > start_date;

-- Authoritative guard for every write path (UI, services, direct API calls).
alter table public.events
  add constraint events_date_order_check
  check (registration_deadline <= start_date and start_date < end_date);

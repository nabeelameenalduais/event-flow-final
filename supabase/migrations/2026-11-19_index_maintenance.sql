-- Performance maintenance: cover unindexed foreign keys and remove exact
-- duplicate indexes. Only the application's public schema is touched.

-- One covering index per unindexed FK leading column. Unique indexes already
-- covering the column (e.g. tickets.registration_id) are detected and skipped.
do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass as tbl, a.attname as col
    from pg_constraint c
    cross join lateral unnest(c.conkey) with ordinality as k(attnum, ord)
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f'
      and c.connamespace = 'public'::regnamespace
      and k.ord = 1
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid and i.indkey[0] = k.attnum
      )
    group by c.conrelid, a.attname
  loop
    execute format(
      'create index if not exists %I on %s (%I)',
      'idx_fk_' || r.tbl::text || '_' || r.col,
      r.tbl::text,
      r.col
    );
  end loop;
end $$;

-- Exact duplicates identified by the database advisor. The canonical index
-- (usually the constraint-backed unique index) is kept in each case.
drop index if exists public.attendance_ticket_key;         -- duplicate of attendance_ticket_id_key (unique)
drop index if exists public.idx_attendance_ticket;         -- duplicate of attendance_ticket_idx
drop index if exists public.idx_feedback_event;            -- duplicate of feedback_event_idx
drop index if exists public.idx_invitation_links_event_id; -- duplicate of invitation_links_event_idx
drop index if exists public.idx_profiles_user_id;          -- duplicate of profiles_user_idx / profiles_user_id_key
drop index if exists public.idx_registrations_attendee;    -- duplicate of registrations_attendee_idx
drop index if exists public.idx_tickets_registration;      -- duplicate of tickets_registration_idx / tickets_registration_id_key
drop index if exists public.idx_users_email;               -- duplicate of users_email_idx / users_email_key

-- ============================================================
-- EventFlow — Demo login accounts (quick access)
-- Run this in the Supabase SQL Editor after schema.sql.
--
-- Creates/updates three accounts that can log in immediately:
--   admin@eventflow.com      / one  -> admin
--   organizer@eventflow.com  / one  -> organizer
--   attendee@eventflow.com   / one  -> attendee
-- ============================================================

create extension if not exists pgcrypto;

-- Roles (ids match the existing seeded roles, so this is safe to re-run).
insert into public.roles (id, name, description) values
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'admin',     'Full access to all system features'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'organizer', 'Manage their assigned events'),
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'attendee',  'Browse and register for events')
on conflict (id) do nothing;

-- Users: reset the password to "one" every time this is run.
insert into public.users (id, email, password_hash, suspended, must_change_password, created_at, updated_at)
values
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'admin@eventflow.com',     crypt('one', gen_salt('bf', 10)), false, false, now(), now()),
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'organizer@eventflow.com', crypt('one', gen_salt('bf', 10)), false, false, now(), now()),
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'attendee@eventflow.com',  crypt('one', gen_salt('bf', 10)), false, false, now(), now())
on conflict (email) do update set
  password_hash         = excluded.password_hash,
  suspended             = false,
  must_change_password  = false,
  deleted_at            = null,
  deletion_requested_at = null,
  scheduled_deletion_at = null,
  recovered_at          = null,
  updated_at            = now();

-- Profiles with the correct role for each account.
insert into public.profiles (id, user_id, first_name, last_name, phone_number, avatar_url, role_id, registration_status, manages_all_events)
values
  (gen_random_uuid(), 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'Alice',   'Admin',     '', '', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'complete', true),
  (gen_random_uuid(), 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'Bob',     'Organizer', '', '', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'complete', false),
  (gen_random_uuid(), 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'Charlie', 'Attendee',  '', '', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'complete', false)
on conflict (user_id) do update set
  role_id            = excluded.role_id,
  registration_status = 'complete',
  manages_all_events = excluded.manages_all_events;

-- Make sure no leftover failed-login counter blocks the demo logins.
delete from public.auth_attempts
where email in ('admin@eventflow.com', 'organizer@eventflow.com', 'attendee@eventflow.com');

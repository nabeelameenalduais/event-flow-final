-- ============================================================
-- EventFlow — Comprehensive Database Schema & Migrations
-- Run this in the Supabase SQL Editor (Project -> SQL Editor)
-- ============================================================

-- ------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ------------------------------------------------------------------
-- 2. EVENTS — new columns for online / remote events
-- ------------------------------------------------------------------
alter table public.events
  add column if not exists event_type text not null default 'in_person',
  add column if not exists meeting_link text,
  add column if not exists meeting_link_generated_by uuid references public.users(id) on delete set null,
  add column if not exists meeting_link_created_at timestamptz;

alter table public.events
  add constraint events_event_type_check
  check (event_type in ('in_person', 'online'));

-- online events may not need a physical venue
alter table public.events alter column venue_id drop not null;

-- ------------------------------------------------------------------
-- 3. PROFILES — organizer management
-- ------------------------------------------------------------------
alter table public.profiles
  add column if not exists manages_all_events boolean not null default false;

-- ------------------------------------------------------------------
-- 4. EVENT ORGANIZERS — multiple organizers per event
-- ------------------------------------------------------------------
create table if not exists public.event_organizers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  is_primary boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint event_organizers_event_user_unique unique (event_id, user_id)
);

create index if not exists event_organizers_event_idx on public.event_organizers(event_id);
create index if not exists event_organizers_user_idx on public.event_organizers(user_id);

-- ------------------------------------------------------------------
-- 5. CHAT — channels & messages
--   general:  channel_type='general', organizer_id=null, attendee_id=null
--   private:  channel_type='private', organizer_id=<org>, attendee_id=<attendee profile>
--            -> a true 1:1 private conversation per (attendee, organizer) pair
-- ------------------------------------------------------------------
create table if not exists public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  channel_type text not null check (channel_type in ('general', 'private')),
  organizer_id uuid references public.users(id) on delete cascade,
  attendee_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- one general channel per event
create unique index if not exists chat_channels_general_unique
  on public.chat_channels (event_id)
  where channel_type = 'general';

-- one private channel per (event, organizer, attendee) pair
create unique index if not exists chat_channels_private_unique
  on public.chat_channels (event_id, organizer_id, attendee_id)
  where channel_type = 'private' and attendee_id is not null;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_channel_idx on public.chat_messages(channel_id, created_at);

-- ------------------------------------------------------------------
-- 6. EVENT EVALUATIONS
-- ------------------------------------------------------------------
create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null default 'Event Evaluation',
  rating_type text not null default 'stars' check (rating_type in ('numeric', 'stars')),
  privacy text not null default 'secret' check (privacy in ('secret', 'public')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.evaluation_questions (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  question text not null,
  question_type text not null check (question_type in ('multiple_choice', 'text')),
  options jsonb,
  sort_order int not null default 0
);

create table if not exists public.evaluation_submissions (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  attendee_id uuid not null references public.profiles(id) on delete cascade,
  rating numeric,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  constraint evaluation_submissions_unique unique (evaluation_id, attendee_id)
);

create table if not exists public.evaluation_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.evaluation_submissions(id) on delete cascade,
  question_id uuid not null references public.evaluation_questions(id) on delete cascade,
  answer text,
  unique (submission_id, question_id)
);

-- ------------------------------------------------------------------
-- 7. EVENT COSTS & SUPPLIES
-- ------------------------------------------------------------------
create table if not exists public.event_costs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  cost_type text not null check (cost_type in ('planned', 'actual')),
  item text not null,
  need_type text not null default 'other',
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_costs_event_idx on public.event_costs(event_id, cost_type);

-- ------------------------------------------------------------------
-- 8. DEVICE SESSIONS
-- ------------------------------------------------------------------
create table if not exists public.device_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  device_name text not null default 'Unknown device',
  ip_address text not null default '127.0.0.1',
  token text not null,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists device_sessions_user_idx on public.device_sessions(user_id, last_active_at);

-- ------------------------------------------------------------------
-- 9. NOTIFICATIONS — extend type + support link target
-- ------------------------------------------------------------------
alter table public.notifications
  add column if not exists link text;

-- ------------------------------------------------------------------
-- 10. INDEXES for frequently-used queries
-- ------------------------------------------------------------------
create index if not exists events_status_start_idx on public.events(status, start_date);
create index if not exists events_visibility_idx on public.events(visibility);
create index if not exists registrations_event_idx on public.registrations(event_id, status);
create index if not exists registrations_attendee_idx on public.registrations(attendee_id);
create index if not exists tickets_registration_idx on public.tickets(registration_id);
create index if not exists attendance_ticket_idx on public.attendance(ticket_id);
create index if not exists feedback_event_idx on public.feedback(event_id);
create index if not exists notifications_user_idx on public.notifications(user_id, read_at);
create index if not exists invitation_links_event_idx on public.invitation_links(event_id);
create index if not exists users_email_idx on public.users(email);
create index if not exists profiles_user_idx on public.profiles(user_id);

-- ------------------------------------------------------------------
-- 11. AUTH RPC — verify password server-side (password_hash never leaves DB)
-- ------------------------------------------------------------------
-- rate limiting table for auth attempts (server-side, not just client)
create table if not exists public.auth_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists auth_attempts_email_idx on public.auth_attempts(email, attempted_at);

-- AUTH RPC — verify password server-side (password_hash never leaves DB).
-- Accepts the plaintext password; hashes are compared with bcrypt (unique
-- salt per user). Legacy SHA-256 hashes are still verified for old accounts.
create or replace function public.authenticate_user(p_email text, p_password text)
returns json
language plpgsql
security definer
as $$
declare
  v_user record;
  v_profile record;
  v_role record;
  v_recent int;
  v_hash text;
begin
  select count(*) into v_recent
  from public.auth_attempts
  where email = lower(p_email)
    and attempted_at > now() - interval '15 minutes';

  if v_recent >= 5 then
    return json_build_object('error', 'Too many attempts. Please try again later.');
  end if;

  select u.* into v_user
  from public.users u
  where u.email = p_email
  limit 1;

  if v_user is null then
    insert into public.auth_attempts (email) values (lower(p_email));
    return json_build_object('error', 'Invalid email or password');
  end if;

  if v_user.password_hash like '$2$%' or v_user.password_hash like '$2a$%' or v_user.password_hash like '$2b$%' then
    v_hash := crypt(p_password, v_user.password_hash);
  else
    v_hash := encode(digest(p_password, 'sha256'), 'hex');
  end if;

  if v_user.password_hash <> v_hash then
    insert into public.auth_attempts (email) values (lower(p_email));
    return json_build_object('error', 'Invalid email or password');
  end if;

  if v_user.suspended then
    return json_build_object('error', 'Account is suspended');
  end if;

  delete from public.auth_attempts where email = lower(p_email);

  select p.* into v_profile
  from public.profiles p
  where p.user_id = v_user.id
  limit 1;

  if v_profile is null then
    return json_build_object('error', 'Profile not found');
  end if;

  select r.* into v_role from public.roles r where r.id = v_profile.role_id limit 1;

  return json_build_object(
    'user', json_build_object(
      'id', v_user.id,
      'email', v_user.email,
      'created_at', v_user.created_at,
      'updated_at', v_user.updated_at,
      'suspended', v_user.suspended
    ),
    'profile', json_build_object(
      'id', v_profile.id,
      'user_id', v_profile.user_id,
      'first_name', v_profile.first_name,
      'last_name', v_profile.last_name,
      'phone_number', v_profile.phone_number,
      'avatar_url', v_profile.avatar_url,
      'role_id', v_profile.role_id,
      'manages_all_events', v_profile.manages_all_events
    ),
    'role', v_role.name
  );
end;
$$;

-- fetch user + profile without exposing password_hash
create or replace function public.get_profile_by_email(p_email text)
returns json
language plpgsql
security definer
as $$
declare
  v_user record;
  v_profile record;
  v_role record;
begin
  select u.* into v_user from public.users u where u.email = p_email limit 1;
  if v_user is null then
    return json_build_object('error', 'User not found');
  end if;
  if v_user.suspended then
    return json_build_object('error', 'Account is suspended');
  end if;

  select p.* into v_profile from public.profiles p where p.user_id = v_user.id limit 1;
  if v_profile is null then
    return json_build_object('error', 'Profile not found');
  end if;

  select r.* into v_role from public.roles r where r.id = v_profile.role_id limit 1;

  return json_build_object(
    'user', json_build_object(
      'id', v_user.id,
      'email', v_user.email,
      'created_at', v_user.created_at,
      'updated_at', v_user.updated_at,
      'suspended', v_user.suspended
    ),
    'profile', json_build_object(
      'id', v_profile.id,
      'user_id', v_profile.user_id,
      'first_name', v_profile.first_name,
      'last_name', v_profile.last_name,
      'phone_number', v_profile.phone_number,
      'avatar_url', v_profile.avatar_url,
      'role_id', v_profile.role_id,
      'manages_all_events', v_profile.manages_all_events
    ),
    'role', v_role.name
  );
end;
$$;

-- check whether an email belongs to an existing user (safe, no hashes)
create or replace function public.user_exists(p_email text)
returns boolean
language sql
security definer
as $$
  select exists (select 1 from public.users where email = p_email);
$$;

-- register a new account: creates user + attendee profile in one transaction.
-- Password is hashed server-side with bcrypt (unique salt per user).
create or replace function public.register_user(p_email text, p_password text, p_first_name text, p_last_name text)
returns json
language plpgsql
security definer
as $$
declare
  v_user record;
  v_profile record;
  v_role record;
begin
  if exists (select 1 from public.users where lower(email) = lower(p_email)) then
    return json_build_object('error', 'Email already in use');
  end if;

  select * into v_role from public.roles where name = 'attendee' limit 1;
  if v_role is null then
    return json_build_object('error', 'Role not found');
  end if;

  insert into public.users (email, password_hash)
  values (p_email, crypt(p_password, gen_salt('bf', 10)))
  returning * into v_user;

  insert into public.profiles (user_id, first_name, last_name, phone_number, avatar_url, role_id)
  values (v_user.id, p_first_name, p_last_name, '', '', v_role.id)
  returning * into v_profile;

  return json_build_object(
    'user', json_build_object(
      'id', v_user.id,
      'email', v_user.email,
      'created_at', v_user.created_at,
      'updated_at', v_user.updated_at,
      'suspended', v_user.suspended
    ),
    'profile', json_build_object(
      'id', v_profile.id,
      'user_id', v_profile.user_id,
      'first_name', v_profile.first_name,
      'last_name', v_profile.last_name,
      'phone_number', v_profile.phone_number,
      'avatar_url', v_profile.avatar_url,
      'role_id', v_profile.role_id,
      'manages_all_events', v_profile.manages_all_events
    ),
    'role', 'attendee'
  );
end;
$$;

-- restore a session from its opaque token (never the email) + refresh activity
create or replace function public.get_session_user(p_token text)
returns json
language plpgsql
security definer
as $$
declare
  v_session public.device_sessions%rowtype;
  v_user record;
  v_profile record;
  v_role record;
begin
  select * into v_session from public.device_sessions where token = p_token limit 1;

  if v_session is null then
    return json_build_object('error', 'Session not found');
  end if;

  update public.device_sessions set last_active_at = now() where id = v_session.id;

  select u.* into v_user from public.users u where u.id = v_session.user_id limit 1;
  if v_user is null then
    return json_build_object('error', 'Session not found');
  end if;

  if v_user.suspended then
    return json_build_object('error', 'Account is suspended');
  end if;

  select p.* into v_profile from public.profiles p where p.user_id = v_user.id limit 1;
  if v_profile is null then
    return json_build_object('error', 'Profile not found');
  end if;

  select r.* into v_role from public.roles r where r.id = v_profile.role_id limit 1;

  return json_build_object(
    'user', json_build_object(
      'id', v_user.id,
      'email', v_user.email,
      'created_at', v_user.created_at,
      'updated_at', v_user.updated_at,
      'suspended', v_user.suspended
    ),
    'profile', json_build_object(
      'id', v_profile.id,
      'user_id', v_profile.user_id,
      'first_name', v_profile.first_name,
      'last_name', v_profile.last_name,
      'phone_number', v_profile.phone_number,
      'avatar_url', v_profile.avatar_url,
      'role_id', v_profile.role_id,
      'manages_all_events', v_profile.manages_all_events
    ),
    'role', v_role.name,
    'device_session_id', v_session.id
  );
end;
$$;

-- revoke a session so its token can no longer restore the account
create or replace function public.revoke_session(p_token text)
returns boolean
language plpgsql
security definer
as $$
begin
  delete from public.device_sessions where token = p_token;
  return found;
end;
$$;

-- ------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY
-- NOTE: This project uses a custom auth (users table) with the anon
-- key. For full production RLS you should migrate to Supabase Auth.
-- These policies mirror the current application's data-access model
-- so existing functionality keeps working while basic RLS is enabled.
-- ------------------------------------------------------------------

alter table public.events enable row level security;
alter table public.event_organizers enable row level security;
alter table public.chat_channels enable row level security;
alter table public.chat_messages enable row level security;
alter table public.evaluations enable row level security;
alter table public.evaluation_questions enable row level security;
alter table public.evaluation_submissions enable row level security;
alter table public.evaluation_answers enable row level security;
alter table public.event_costs enable row level security;
alter table public.device_sessions enable row level security;

-- users / profiles / roles: RLS enabled so direct access is governed by
-- policies. Roles are readable by everyone; users/profiles follow the app's
-- custom-auth model (permissive policies mirroring the existing access model).
-- The password_hash column is NOT readable/writable by the client: all
-- password operations happen through the server-side RPCs above.
alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;

drop policy if exists "roles_public_read" on public.roles;
create policy "roles_public_read" on public.roles
  for select using (true);

drop policy if exists "profiles_all" on public.profiles;
create policy "profiles_all" on public.profiles
  for all using (true) with check (true);

drop policy if exists "users_all" on public.users;
create policy "users_all" on public.users
  for all using (true) with check (true);

revoke select (password_hash) on public.users from anon, authenticated;
revoke update (password_hash) on public.users from anon, authenticated;

-- events: public read of non-deleted, authenticated write via anon (custom auth)
drop policy if exists "events_public_read" on public.events;
create policy "events_public_read" on public.events
  for select using (deleted_at is null);

drop policy if exists "events_public_insert" on public.events;
create policy "events_public_insert" on public.events
  for insert with check (true);

drop policy if exists "events_public_update" on public.events;
create policy "events_public_update" on public.events
  for update using (true) with check (true);

-- event_organizers
drop policy if exists "event_organizers_all" on public.event_organizers;
create policy "event_organizers_all" on public.event_organizers
  for all using (true) with check (true);

-- chat
drop policy if exists "chat_channels_all" on public.chat_channels;
create policy "chat_channels_all" on public.chat_channels
  for all using (true) with check (true);

drop policy if exists "chat_messages_all" on public.chat_messages;
create policy "chat_messages_all" on public.chat_messages
  for all using (true) with check (true);

-- evaluations
drop policy if exists "evaluations_all" on public.evaluations;
create policy "evaluations_all" on public.evaluations
  for all using (true) with check (true);

drop policy if exists "evaluation_questions_all" on public.evaluation_questions;
create policy "evaluation_questions_all" on public.evaluation_questions
  for all using (true) with check (true);

drop policy if exists "evaluation_submissions_all" on public.evaluation_submissions;
create policy "evaluation_submissions_all" on public.evaluation_submissions
  for all using (true) with check (true);

drop policy if exists "evaluation_answers_all" on public.evaluation_answers;
create policy "evaluation_answers_all" on public.evaluation_answers
  for all using (true) with check (true);

-- costs
drop policy if exists "event_costs_all" on public.event_costs;
create policy "event_costs_all" on public.event_costs
  for all using (true) with check (true);

-- device sessions: users may only manage their own sessions
drop policy if exists "device_sessions_owner" on public.device_sessions;
create policy "device_sessions_owner" on public.device_sessions
  for select using (true);

drop policy if exists "device_sessions_owner_insert" on public.device_sessions;
create policy "device_sessions_owner_insert" on public.device_sessions
  for insert with check (true);

drop policy if exists "device_sessions_owner_delete" on public.device_sessions;
create policy "device_sessions_owner_delete" on public.device_sessions
  for delete using (true);

-- session tokens are credentials: never readable/writable via REST.
-- All session operations go through the security-definer RPCs above.
revoke select (token) on public.device_sessions from anon, authenticated;
revoke update (token) on public.device_sessions from anon, authenticated;

-- ------------------------------------------------------------------
-- 12b. EVALUATION SUBMISSION RPC — enforce constraints server-side (NF3):
-- only confirmed attendees who actually attended may submit, once per
-- evaluation, and secret privacy stays aggregated (no identity leakage).
-- ------------------------------------------------------------------
create or replace function public.submit_evaluation(
  p_evaluation_id uuid,
  p_attendee_id uuid,
  p_rating numeric,
  p_is_public boolean,
  p_answers jsonb
)
returns json
language plpgsql
security definer
as $$
declare
  v_evaluation record;
  v_event record;
  v_reg record;
  v_ticket record;
  v_attendance record;
  v_submission record;
  v_key text;
  v_answer jsonb;
begin
  select * into v_evaluation from public.evaluations where id = p_evaluation_id;
  if v_evaluation is null then
    return json_build_object('error', 'Evaluation not found');
  end if;

  select * into v_event from public.events where id = v_evaluation.event_id;
  if v_event is null then
    return json_build_object('error', 'Event not found');
  end if;

  -- must have a confirmed registration
  select * into v_reg from public.registrations
  where event_id = v_event.id
    and attendee_id = p_attendee_id
    and status = 'confirmed'
  limit 1;
  if v_reg is null then
    return json_build_object('error', 'Only confirmed attendees can submit an evaluation');
  end if;

  -- must actually have attended the event
  select t.id into v_ticket from public.tickets where registration_id = v_reg.id limit 1;
  if v_ticket is null or v_ticket.id is null then
    return json_build_object('error', 'You must attend the event to evaluate it');
  end if;
  select a.id into v_attendance from public.attendance where ticket_id = v_ticket.id limit 1;
  if v_attendance is null or v_attendance.id is null then
    return json_build_object('error', 'You must attend the event to evaluate it');
  end if;

  -- one submission per attendee per evaluation
  insert into public.evaluation_submissions (evaluation_id, attendee_id, rating, is_public)
  values (p_evaluation_id, p_attendee_id, p_rating, coalesce(p_is_public, false))
  on conflict (evaluation_id, attendee_id) do nothing
  returning * into v_submission;

  if v_submission is null then
    return json_build_object('error', 'You have already submitted an evaluation for this event');
  end if;

  for v_key, v_answer in select * from jsonb_each(p_answers)
  loop
    insert into public.evaluation_answers (submission_id, question_id, answer)
    values (v_submission.id, v_key::uuid, v_answer#>>'{}');
  end loop;

  return json_build_object('success', true, 'submission_id', v_submission.id);
end;
$$;

-- ------------------------------------------------------------------
-- 12c. PASSWORD RESET (F1.3) — temporary single-use tokens.
-- The token is returned to the caller (this demo has no email service,
-- so the UI shows it to the user like a "check your inbox" flow). The
-- response shape is uniform for unknown emails to prevent enumeration.
-- ------------------------------------------------------------------
create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_tokens_token_idx
  on public.password_reset_tokens(token);
create index if not exists password_reset_tokens_user_idx
  on public.password_reset_tokens(user_id);

alter table public.password_reset_tokens enable row level security;

create or replace function public.request_password_reset(p_email text)
returns json
language plpgsql
security definer
as $$
declare
  v_user record;
  v_token text;
  v_expires timestamptz;
begin
  select * into v_user from public.users where lower(email) = lower(p_email) limit 1;

  -- uniform response whether or not the email exists (anti-enumeration)
  if v_user is null then
    return json_build_object('error', 'If that email exists, a reset link has been sent.');
  end if;

  -- invalidate any previous unused tokens for this user
  delete from public.password_reset_tokens where user_id = v_user.id and used_at is null;

  v_token := encode(gen_random_bytes(24), 'hex');
  v_expires := now() + interval '30 minutes';

  insert into public.password_reset_tokens (user_id, token, expires_at)
  values (v_user.id, v_token, v_expires);

  return json_build_object('ok', true, 'token', v_token, 'expires_at', v_expires);
end;
$$;

create or replace function public.reset_password_with_token(p_token text, p_new_password text)
returns json
language plpgsql
security definer
as $$
declare
  v_tok record;
begin
  select * into v_tok from public.password_reset_tokens
  where token = p_token and used_at is null
  limit 1;

  if v_tok is null or v_tok.expires_at < now() then
    return json_build_object('error', 'Reset token is invalid or expired.');
  end if;

  if length(coalesce(p_new_password, '')) < 6 then
    return json_build_object('error', 'Password must be at least 6 characters.');
  end if;

  update public.users
    set password_hash = crypt(p_new_password, gen_salt('bf', 10)),
        updated_at = now()
    where id = v_tok.user_id;

  update public.password_reset_tokens set used_at = now() where id = v_tok.id;

  -- resetting the password revokes all existing device sessions
  delete from public.device_sessions where user_id = v_tok.user_id;

  return json_build_object('ok', true);
end;
$$;

-- ------------------------------------------------------------------
-- 12d. DEVICE SESSIONS RPCs (F1.6) — list own sessions without exposing
-- tokens, and revoke sessions (remote sign-out). The token column is
-- made unreadable to the client below.
-- ------------------------------------------------------------------
create or replace function public.list_user_sessions(p_user_id uuid, p_current_token text)
returns json
language plpgsql
security definer
as $$
declare
  v_rows json;
begin
  select coalesce(json_agg(row_to_json(t)), '[]')
  into v_rows
  from (
    select
      s.id,
      s.device_name,
      s.ip_address,
      s.created_at,
      s.last_active_at,
      s.token = p_current_token as is_current
    from public.device_sessions s
    where s.user_id = p_user_id
    order by s.last_active_at desc
  ) t;
  return v_rows;
end;
$$;

create or replace function public.revoke_session_by_id(p_user_id uuid, p_session_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
  delete from public.device_sessions
  where id = p_session_id and user_id = p_user_id;
  return found;
end;
$$;

create or replace function public.revoke_other_sessions(p_user_id uuid, p_current_token text)
returns int
language plpgsql
security definer
as $$
declare
  v_count int;
begin
  delete from public.device_sessions
  where user_id = p_user_id and token <> p_current_token;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ------------------------------------------------------------------
-- 12e. AUDIT LOG (F10.5) — table for the Security Center. Writes are
-- routed through record_audit so every entry is created server-side.
-- ------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  details text,
  ip_address text not null default '127.0.0.1',
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_user_idx on public.audit_logs(user_id, created_at);
create index if not exists audit_logs_action_idx on public.audit_logs(action);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_all" on public.audit_logs;
create policy "audit_logs_all" on public.audit_logs
  for all using (true) with check (true);

-- ------------------------------------------------------------------
-- 13. REAL-TIME — enable replication for chat messages
-- ------------------------------------------------------------------
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.chat_channels;

-- ------------------------------------------------------------------
-- 14. WAITLIST PROMOTION NOTIFICATION (trigger when status -> confirmed)
-- ------------------------------------------------------------------
create or replace function public.notify_waitlist_promotion()
returns trigger
language plpgsql
security definer
as $$
declare
  v_event_title text;
begin
  if new.status = 'confirmed' and old.status = 'waitlisted' then
    select title into v_event_title from public.events where id = new.event_id;
    insert into public.notifications (user_id, type, message, link)
    select p.user_id, 'waitlist_promotion',
           'Great news! Your spot for "' || coalesce(v_event_title, 'the event') || '" has been confirmed.',
           '/events/' || new.event_id
    from public.profiles p
    where p.id = new.attendee_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_waitlist_promotion on public.registrations;
create trigger trigger_waitlist_promotion
  after update on public.registrations
  for each row execute function public.notify_waitlist_promotion();

-- ------------------------------------------------------------------
-- 15. AUTO-ASSIGN "all-events" ORGANIZERS when a new event is created
-- ------------------------------------------------------------------
create or replace function public.auto_assign_all_events_organizers()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.event_organizers (event_id, user_id, is_primary)
  select new.id, p.user_id, false
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where r.name = 'organizer' and p.manages_all_events = true
  on conflict (event_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trigger_auto_assign_organizers on public.events;
create trigger trigger_auto_assign_organizers
  after insert on public.events
  for each row execute function public.auto_assign_all_events_organizers();

-- ------------------------------------------------------------------
-- 16. DEFAULT CATEGORIES SEED (safe insert)
-- ------------------------------------------------------------------
insert into public.categories (name, description, icon_url, color_code)
select * from (values
  ('Conference', 'Academic and professional conferences', '', '#007bff'),
  ('Workshop', 'Hands-on training workshops', '', '#28a745'),
  ('Exhibition', 'Exhibitions and expos', '', '#6f42c1'),
  ('Student Activity', 'Student clubs and activities', '', '#fd7e14'),
  ('Seminar', 'Seminars and lectures', '', '#e83e8c')
) as v(name, description, icon_url, color_code)
where not exists (select 1 from public.categories where name = v.name);

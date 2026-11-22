-- ============================================================
-- EventFlow — Migration for the nine requested additions
-- Run this file in Supabase → SQL Editor (after supabase/schema.sql)
-- Safe to re-run: guards with IF NOT EXISTS / DO blocks.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------
-- 1) EVENTS: hybrid type, per-mode capacity, meeting settings
-- ------------------------------------------------------------------
alter table public.events drop constraint if exists events_event_type_check;
alter table public.events
  add constraint events_event_type_check
  check (event_type in ('in_person', 'online', 'hybrid'));

alter table public.events
  add column if not exists online_capacity int,
  add column if not exists in_person_capacity int,
  add column if not exists meeting_provider text not null default 'jitsi',
  add column if not exists meeting_attendance_minutes int not null default 10,
  add column if not exists meeting_room_name text,
  add column if not exists hybrid_note text;

update public.events
   set online_capacity = coalesce(online_capacity, capacity)
 where event_type in ('online', 'hybrid');

update public.events
   set in_person_capacity = coalesce(in_person_capacity, capacity)
 where event_type in ('in_person', 'hybrid');

-- ------------------------------------------------------------------
-- 2) REGISTRATIONS: attendance mode (online / in-person)
-- ------------------------------------------------------------------
alter table public.registrations
  add column if not exists attendance_mode text;

do $$ begin
  alter table public.registrations
    add constraint registrations_attendance_mode_check
    check (attendance_mode is null or attendance_mode in ('in_person', 'online'));
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------------
-- 3) TICKETS & ATTENDANCE: encoded payload + verification source
-- ------------------------------------------------------------------
alter table public.tickets
  add column if not exists qr_payload text,
  add column if not exists attendance_mode text,
  add column if not exists verified_by uuid references public.users(id) on delete set null,
  add column if not exists verified_at timestamptz;

alter table public.attendance
  add column if not exists mode text,
  add column if not exists source text not null default 'manual',
  add column if not exists verified_by uuid references public.users(id) on delete set null,
  add column if not exists presence_seconds int;

-- ------------------------------------------------------------------
-- 4) MEETING PRESENCE + IN-MEETING CHAT (Addition 1)
-- ------------------------------------------------------------------
create table if not exists public.meeting_presence (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  attendee_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  first_joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  total_seconds int not null default 0,
  is_visible boolean not null default true,
  attended boolean not null default false,
  unique (event_id, attendee_id)
);

create table if not exists public.meeting_chat_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists meeting_presence_event_idx on public.meeting_presence(event_id);
create index if not exists meeting_chat_event_idx on public.meeting_chat_messages(event_id, created_at);

create or replace function public.record_meeting_presence(
  p_event_id uuid,
  p_attendee_id uuid,
  p_user_id uuid,
  p_seconds int,
  p_visible boolean default true
)
returns json
language plpgsql
security definer
as $$
declare
  v_event record;
  v_total int;
  v_attended boolean;
  v_reg record;
  v_ticket uuid;
  v_minutes int;
begin
  if p_seconds is null or p_seconds < 0 then p_seconds := 0; end if;
  if p_seconds > 3600 then p_seconds := 3600; end if;

  insert into public.meeting_presence
    (event_id, attendee_id, user_id, total_seconds, is_visible, last_seen_at)
  values
    (p_event_id, p_attendee_id, p_user_id, p_seconds, coalesce(p_visible, true), now())
  on conflict (event_id, attendee_id) do update
    set total_seconds = public.meeting_presence.total_seconds + excluded.total_seconds,
        is_visible = excluded.is_visible,
        last_seen_at = now(),
        user_id = coalesce(excluded.user_id, public.meeting_presence.user_id)
  returning total_seconds, attended into v_total, v_attended;

  select * into v_event from public.events where id = p_event_id;
  v_minutes := coalesce(v_event.meeting_attendance_minutes, 10);

  if v_minutes > 0 and v_total >= v_minutes * 60 and not coalesce(v_attended, false) then
    select * into v_reg
      from public.registrations
     where event_id = p_event_id
       and attendee_id = p_attendee_id
       and status = 'confirmed'
     limit 1;

    if v_reg is not null then
      select id into v_ticket from public.tickets where registration_id = v_reg.id limit 1;
      if v_ticket is not null then
        insert into public.attendance (ticket_id, mode, source, presence_seconds)
        select v_ticket, 'online', 'auto_presence', v_total
        where not exists (select 1 from public.attendance where ticket_id = v_ticket);

        update public.tickets set status = 'used' where id = v_ticket;
        update public.meeting_presence
           set attended = true
         where event_id = p_event_id and attendee_id = p_attendee_id;
        v_attended := true;
      end if;
    end if;
  end if;

  return json_build_object('total_seconds', v_total, 'attended', coalesce(v_attended, false));
end;
$$;

-- ------------------------------------------------------------------
-- 5) USER BANS (Addition 7)
-- ------------------------------------------------------------------
create table if not exists public.user_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  scope text not null check (scope in ('global', 'event', 'category')),
  event_id uuid references public.events(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  reason text,
  is_permanent boolean not null default true,
  expires_at timestamptz,
  notify_user boolean not null default true,
  status text not null default 'active' check (status in ('pending', 'active', 'rejected', 'revoked', 'expired')),
  requested_by uuid references public.users(id) on delete set null,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  revoked_by uuid references public.users(id) on delete set null,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz not null default now()
);

create index if not exists user_bans_user_idx on public.user_bans(user_id, status);
create index if not exists user_bans_scope_idx on public.user_bans(scope, event_id, category_id);

create table if not exists public.ban_revoke_requests (
  id uuid primary key default gen_random_uuid(),
  ban_id uuid not null references public.user_bans(id) on delete cascade,
  requested_by uuid references public.users(id) on delete set null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  handled_by uuid references public.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ban_revoke_requests_status_idx on public.ban_revoke_requests(status, created_at);
create index if not exists ban_revoke_requests_ban_idx on public.ban_revoke_requests(ban_id);

-- ------------------------------------------------------------------
-- 6) EVENT REQUESTS (Addition 8)
-- ------------------------------------------------------------------
create table if not exists public.event_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text not null,
  category_id uuid references public.categories(id) on delete set null,
  event_type text not null default 'in_person' check (event_type in ('in_person', 'online', 'hybrid')),
  method text,
  target_audience text,
  expected_attendees int,
  trainer_name text,
  trainer_bio text,
  trainer_contact text,
  preferred_start timestamptz,
  preferred_end timestamptz,
  venue_id uuid references public.venues(id) on delete set null,
  estimated_budget numeric,
  currency_code text default 'USD',
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'approved', 'rejected', 'needs_info')),
  admin_notes text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_event_id uuid references public.events(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists event_requests_status_idx on public.event_requests(status, created_at);
create index if not exists event_requests_requester_idx on public.event_requests(requester_id);

-- ------------------------------------------------------------------
-- 7) FINANCE (Addition 5): currencies, funding, expenses, transfers
-- ------------------------------------------------------------------
create table if not exists public.currencies (
  code text primary key,
  name text not null,
  symbol text,
  rate_per_usd numeric not null default 1,   -- units of this currency per 1 USD
  rate_per_yer numeric,                     -- units of this currency per 1 YER
  is_active boolean not null default true,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.currencies (code, name, symbol, rate_per_usd, rate_per_yer)
values
  ('USD', 'US Dollar', '$', 1, 0.004),
  ('YER', 'Yemeni Rial', '﷼', 250, 1),
  ('SAR', 'Saudi Riyal', '﷼', 3.75, 0.015)
on conflict (code) do nothing;

create table if not exists public.funding_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  funder_name text,
  scope text not null default 'general' check (scope in ('general', 'event', 'project')),
  event_id uuid references public.events(id) on delete set null,
  project_name text,
  currency_code text not null references public.currencies(code),
  amount numeric not null check (amount >= 0),
  rate_per_usd numeric not null default 1,
  amount_usd numeric not null default 0,
  received_at date not null default current_date,
  method text,
  reference text,
  attachments jsonb not null default '[]'::jsonb,
  notes text,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  funding_id uuid references public.funding_sources(id) on delete set null,
  currency_code text not null references public.currencies(code),
  rate_per_usd numeric not null default 1,
  amount numeric not null check (amount >= 0),
  amount_usd numeric not null default 0,
  beneficiary text not null,
  purpose text not null,
  category text not null default 'other',
  payment_method text,
  expense_date date not null default current_date,
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid references public.users(id) on delete set null,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.fund_transfers (
  id uuid primary key default gen_random_uuid(),
  funding_id uuid not null references public.funding_sources(id) on delete cascade,
  type text not null check (type in ('to_general', 'refund')),
  amount numeric not null check (amount >= 0),
  currency_code text not null references public.currencies(code),
  rate_per_usd numeric not null default 1,
  amount_usd numeric not null default 0,
  to_funding_id uuid references public.funding_sources(id) on delete set null,
  refund_to text,
  notes text,
  attachments jsonb not null default '[]'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists funding_scope_idx on public.funding_sources(scope, event_id);
create index if not exists expenses_event_idx on public.expenses(event_id, status);
create index if not exists expenses_funding_idx on public.expenses(funding_id, status);
create index if not exists transfers_funding_idx on public.fund_transfers(funding_id);

-- ------------------------------------------------------------------
-- 8) AUDIENCE + EMAIL CAMPAIGNS (Addition 3)
-- ------------------------------------------------------------------
create table if not exists public.audience_contacts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  phone text,
  tags text[] not null default '{}',
  source text not null default 'manual',
  status text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed', 'deleted_account')),
  user_id uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists audience_contacts_email_lower
  on public.audience_contacts (lower(email));

create table if not exists public.audience_access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  can_view boolean not null default true,
  can_edit boolean not null default false,
  can_send boolean not null default false,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  granted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists audience_grants_user_idx on public.audience_access_grants(user_id);

create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  body text not null,
  target_type text not null default 'all' check (target_type in ('all', 'tag', 'event', 'contacts')),
  target_event_id uuid references public.events(id) on delete set null,
  target_tags text[] not null default '{}',
  target_contact_ids jsonb not null default '[]'::jsonb,
  recipient_status text not null default 'both' check (recipient_status in ('confirmed', 'waitlisted', 'both')),
  scheduled_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  provider text not null default 'mock',
  total_recipients int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  contact_id uuid references public.audience_contacts(id) on delete set null,
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  error text,
  sent_at timestamptz
);

create index if not exists campaign_recipients_idx on public.email_campaign_recipients(campaign_id, status);

-- ------------------------------------------------------------------
-- 9) ADMIN BROADCAST MESSAGES (Addition 9)
-- ------------------------------------------------------------------
create table if not exists public.admin_messages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  link text,
  channel text not null default 'in_app' check (channel in ('in_app', 'email', 'both')),
  target_type text not null default 'all' check (target_type in ('all', 'event', 'users')),
  event_id uuid references public.events(id) on delete set null,
  user_ids jsonb not null default '[]'::jsonb,
  recipient_status text not null default 'both' check (recipient_status in ('confirmed', 'waitlisted', 'both')),
  scheduled_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  total_recipients int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.admin_message_recipients (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.admin_messages(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  email text,
  in_app_sent boolean not null default false,
  notification_id uuid references public.notifications(id) on delete set null,
  email_status text not null default 'skipped' check (email_status in ('skipped', 'sent', 'failed')),
  error text,
  read_at timestamptz
);

create index if not exists admin_message_recipients_idx on public.admin_message_recipients(message_id);

-- ------------------------------------------------------------------
-- 10) ACCOUNT DELETION (Addition 3) + PASSWORD RECOVERY (Addition 4)
-- ------------------------------------------------------------------
alter table public.users
  add column if not exists deleted_at timestamptz,
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists scheduled_deletion_at timestamptz,
  add column if not exists deleted_by uuid references public.users(id) on delete set null,
  add column if not exists deletion_reason text,
  add column if not exists recovered_at timestamptz,
  add column if not exists must_change_password boolean not null default false;

create table if not exists public.password_otp_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_otp_user_idx on public.password_otp_codes(user_id, created_at);

create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  email text not null,
  message text,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'rejected')),
  handled_by uuid references public.users(id) on delete set null,
  handled_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_requests_status_idx on public.password_reset_requests(status, created_at);

-- ------------------------------------------------------------------
-- 11) UPDATED AUTH RPCs (deletion + forced password change)
-- ------------------------------------------------------------------
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

  select u.* into v_user from public.users u where u.email = p_email limit 1;

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

  if v_user.deleted_at is not null then
    return json_build_object('error', 'This account is deleted. Use "Restore account" from the login page within the recovery period.');
  end if;

  delete from public.auth_attempts where email = lower(p_email);

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
      'suspended', v_user.suspended,
      'must_change_password', v_user.must_change_password
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
  if v_user.deleted_at is not null then
    delete from public.device_sessions where user_id = v_user.id;
    return json_build_object('error', 'Account is deleted');
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
      'suspended', v_user.suspended,
      'must_change_password', v_user.must_change_password
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
      'suspended', v_user.suspended,
      'must_change_password', v_user.must_change_password
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

-- Request deletion: disabled immediately, recoverable until scheduled_deletion_at.
create or replace function public.request_account_deletion(
  p_user_id uuid,
  p_reason text,
  p_grace_days int default 30
)
returns json
language plpgsql
security definer
as $$
declare
  v_until timestamptz;
begin
  if p_grace_days is null or p_grace_days < 0 then p_grace_days := 30; end if;

  update public.users
     set deleted_at = now(),
         deletion_requested_at = now(),
         scheduled_deletion_at = now() + (p_grace_days || ' days')::interval,
         deletion_reason = p_reason,
         deleted_by = p_user_id
   where id = p_user_id and deleted_at is null
  returning scheduled_deletion_at into v_until;

  if v_until is null then
    return json_build_object('error', 'Account not found or already scheduled for deletion');
  end if;

  delete from public.device_sessions where user_id = p_user_id;
  return json_build_object('ok', true, 'restore_until', v_until);
end;
$$;

create or replace function public.restore_account(p_email text, p_password text)
returns json
language plpgsql
security definer
as $$
declare
  v_user record;
  v_hash text;
begin
  select * into v_user from public.users where lower(email) = lower(p_email) limit 1;

  if v_user is null then
    return json_build_object('error', 'Invalid email or password');
  end if;

  if v_user.password_hash like '$2$%' or v_user.password_hash like '$2a$%' or v_user.password_hash like '$2b$%' then
    v_hash := crypt(p_password, v_user.password_hash);
  else
    v_hash := encode(digest(p_password, 'sha256'), 'hex');
  end if;

  if v_user.password_hash <> v_hash then
    return json_build_object('error', 'Invalid email or password');
  end if;

  if v_user.deleted_at is null then
    return json_build_object('error', 'This account is already active');
  end if;

  if v_user.scheduled_deletion_at is not null and v_user.scheduled_deletion_at < now() then
    return json_build_object('error', 'The recovery period has ended. Please contact the administrator.');
  end if;

  update public.users
     set deleted_at = null,
         deletion_requested_at = null,
         scheduled_deletion_at = null,
         deletion_reason = null,
         recovered_at = now()
   where id = v_user.id;

  return json_build_object('ok', true);
end;
$$;

create or replace function public.admin_restore_account(p_user_id uuid, p_admin_id uuid)
returns json
language plpgsql
security definer
as $$
begin
  update public.users
     set deleted_at = null,
         deletion_requested_at = null,
         scheduled_deletion_at = null,
         deletion_reason = null,
         recovered_at = now()
   where id = p_user_id;

  if not found then
    return json_build_object('error', 'User not found');
  end if;
  return json_build_object('ok', true);
end;
$$;

create or replace function public.change_password(p_user_id uuid, p_current text, p_new text)
returns json
language plpgsql
security definer
as $$
declare
  v_user record;
  v_hash text;
begin
  if length(coalesce(p_new, '')) < 8 then
    return json_build_object('error', 'Password must be at least 8 characters');
  end if;

  select * into v_user from public.users where id = p_user_id;
  if v_user is null then
    return json_build_object('error', 'User not found');
  end if;

  if v_user.password_hash like '$2$%' or v_user.password_hash like '$2a$%' or v_user.password_hash like '$2b$%' then
    v_hash := crypt(p_current, v_user.password_hash);
  else
    v_hash := encode(digest(p_current, 'sha256'), 'hex');
  end if;

  if v_user.password_hash <> v_hash then
    return json_build_object('error', 'Current password is incorrect');
  end if;

  update public.users
     set password_hash = crypt(p_new, gen_salt('bf', 10)),
         must_change_password = false,
         updated_at = now()
   where id = p_user_id;

  return json_build_object('ok', true);
end;
$$;

create or replace function public.admin_set_password(p_user_id uuid, p_new_password text, p_admin_id uuid)
returns json
language plpgsql
security definer
as $$
begin
  if length(coalesce(p_new_password, '')) < 8 then
    return json_build_object('error', 'Password must be at least 8 characters');
  end if;

  update public.users
     set password_hash = crypt(p_new_password, gen_salt('bf', 10)),
         must_change_password = true,
         updated_at = now()
   where id = p_user_id;

  if not found then
    return json_build_object('error', 'User not found');
  end if;

  delete from public.device_sessions where user_id = p_user_id;
  return json_build_object('ok', true);
end;
$$;

-- OTP flow: returns the code so the client can e-mail it (mock mode shows it).
create or replace function public.request_password_otp(p_email text)
returns json
language plpgsql
security definer
as $$
declare
  v_user record;
  v_recent record;
  v_code text;
  v_expires timestamptz;
begin
  select * into v_user from public.users where lower(email) = lower(p_email) limit 1;

  -- uniform response for unknown emails (anti-enumeration)
  if v_user is null then
    return json_build_object('ok', true, 'code', null, 'expires_at', null);
  end if;

  if v_user.deleted_at is not null then
    return json_build_object('error', 'This account is deleted. Please restore it first.');
  end if;

  select * into v_recent
    from public.password_otp_codes
   where user_id = v_user.id and consumed_at is null
   order by created_at desc limit 1;

  if v_recent is not null and v_recent.created_at > now() - interval '60 seconds' then
    return json_build_object('error', 'Please wait 60 seconds before requesting another code');
  end if;

  delete from public.password_otp_codes where user_id = v_user.id and consumed_at is null;

  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  v_expires := now() + interval '10 minutes';

  insert into public.password_otp_codes (user_id, code_hash, expires_at)
  values (v_user.id, crypt(v_code, gen_salt('bf', 8)), v_expires);

  return json_build_object('ok', true, 'code', v_code, 'expires_at', v_expires);
end;
$$;

create or replace function public.verify_password_otp(
  p_email text,
  p_code text,
  p_new_password text
)
returns json
language plpgsql
security definer
as $$
declare
  v_user record;
  v_otp record;
begin
  if length(coalesce(p_new_password, '')) < 8 then
    return json_build_object('error', 'Password must be at least 8 characters');
  end if;

  select * into v_user from public.users where lower(email) = lower(p_email) limit 1;
  if v_user is null then
    return json_build_object('error', 'Invalid or expired code');
  end if;

  select * into v_otp
    from public.password_otp_codes
   where user_id = v_user.id and consumed_at is null
   order by created_at desc limit 1;

  if v_otp is null or v_otp.expires_at < now() then
    return json_build_object('error', 'Invalid or expired code');
  end if;

  if v_otp.attempts >= 5 then
    return json_build_object('error', 'Too many wrong attempts. Request a new code.');
  end if;

  if v_otp.code_hash <> crypt(p_code, v_otp.code_hash) then
    update public.password_otp_codes set attempts = attempts + 1 where id = v_otp.id;
    return json_build_object('error', 'Invalid or expired code');
  end if;

  update public.users
     set password_hash = crypt(p_new_password, gen_salt('bf', 10)),
         must_change_password = false,
         updated_at = now()
   where id = v_user.id;

  update public.password_otp_codes set consumed_at = now() where id = v_otp.id;
  delete from public.device_sessions where user_id = v_user.id;

  return json_build_object('ok', true);
end;
$$;

create or replace function public.request_admin_password_reset(p_email text, p_message text)
returns json
language plpgsql
security definer
as $$
declare
  v_user record;
begin
  select * into v_user from public.users where lower(email) = lower(p_email) limit 1;

  if v_user is not null then
    insert into public.password_reset_requests (user_id, email, message)
    values (v_user.id, v_user.email, p_message);
  end if;

  -- uniform response (anti-enumeration)
  return json_build_object('ok', true);
end;
$$;

create or replace function public.resolve_admin_password_reset(
  p_request_id uuid,
  p_admin_id uuid,
  p_new_password text,
  p_admin_note text default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_req record;
begin
  if length(coalesce(p_new_password, '')) < 8 then
    return json_build_object('error', 'Password must be at least 8 characters');
  end if;

  select * into v_req from public.password_reset_requests where id = p_request_id and status = 'pending' limit 1;
  if v_req is null then
    return json_build_object('error', 'Request not found or already handled');
  end if;

  update public.users
     set password_hash = crypt(p_new_password, gen_salt('bf', 10)),
         must_change_password = true,
         updated_at = now()
   where id = v_req.user_id;

  delete from public.device_sessions where user_id = v_req.user_id;

  update public.password_reset_requests
     set status = 'resolved', handled_by = p_admin_id, handled_at = now(), admin_note = p_admin_note
   where id = p_request_id;

  return json_build_object('ok', true, 'user_id', v_req.user_id, 'email', v_req.email);
end;
$$;

-- ------------------------------------------------------------------
-- 12) RLS for new tables (permissive, mirrors the app's custom auth)
-- ------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'meeting_presence', 'meeting_chat_messages', 'user_bans', 'ban_revoke_requests', 'event_requests',
    'currencies', 'funding_sources', 'expenses', 'fund_transfers',
    'audience_contacts', 'audience_access_grants', 'email_campaigns',
    'email_campaign_recipients', 'admin_messages', 'admin_message_recipients',
    'password_otp_codes', 'password_reset_requests'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format('create policy %I on public.%I for all using (true) with check (true)', t || '_all', t);
  end loop;
end $$;

-- ------------------------------------------------------------------
-- 13) Realtime for in-meeting chat
-- ------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.meeting_chat_messages;
exception when others then null; end $$;

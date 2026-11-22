-- Security hardening for the custom-session architecture.
--
-- The app authenticates with its own session tokens (device_sessions), not with
-- Supabase Auth JWTs. Any SECURITY DEFINER RPC that accepts a caller-supplied
-- user/admin id must instead derive the actor from a validated session token.

-- ---------------------------------------------------------------------------
-- 1. Admin-only RPCs: replace unauthenticated `p_admin_id` with a session token
-- ---------------------------------------------------------------------------

drop function if exists public.admin_restore_account(uuid, uuid);
drop function if exists public.admin_set_password(uuid, text, uuid);
drop function if exists public.resolve_admin_password_reset(uuid, uuid, text, text);

create or replace function public.admin_restore_account(
  p_user_id uuid,
  p_session_token text
)
returns json
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_admin uuid;
  v_role text;
  v_suspended boolean;
  v_deleted timestamptz;
begin
  v_admin := public.session_user_id(p_session_token);
  if v_admin is null then
    return json_build_object('error', 'Unauthorized');
  end if;

  select r.name, u.suspended, u.deleted_at
    into v_role, v_suspended, v_deleted
  from public.users u
  join public.profiles p on p.user_id = u.id
  join public.roles r on r.id = p.role_id
  where u.id = v_admin;

  if v_role is distinct from 'admin' or coalesce(v_suspended, false) or v_deleted is not null then
    return json_build_object('error', 'Not authorized');
  end if;

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

create or replace function public.admin_set_password(
  p_user_id uuid,
  p_new_password text,
  p_session_token text
)
returns json
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_admin uuid;
  v_role text;
  v_suspended boolean;
  v_deleted timestamptz;
begin
  v_admin := public.session_user_id(p_session_token);
  if v_admin is null then
    return json_build_object('error', 'Unauthorized');
  end if;

  select r.name, u.suspended, u.deleted_at
    into v_role, v_suspended, v_deleted
  from public.users u
  join public.profiles p on p.user_id = u.id
  join public.roles r on r.id = p.role_id
  where u.id = v_admin;

  if v_role is distinct from 'admin' or coalesce(v_suspended, false) or v_deleted is not null then
    return json_build_object('error', 'Not authorized');
  end if;

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

create or replace function public.resolve_admin_password_reset(
  p_request_id uuid,
  p_new_password text,
  p_session_token text,
  p_admin_note text default null
)
returns json
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_admin uuid;
  v_role text;
  v_suspended boolean;
  v_deleted timestamptz;
  v_req record;
begin
  v_admin := public.session_user_id(p_session_token);
  if v_admin is null then
    return json_build_object('error', 'Unauthorized');
  end if;

  select r.name, u.suspended, u.deleted_at
    into v_role, v_suspended, v_deleted
  from public.users u
  join public.profiles p on p.user_id = u.id
  join public.roles r on r.id = p.role_id
  where u.id = v_admin;

  if v_role is distinct from 'admin' or coalesce(v_suspended, false) or v_deleted is not null then
    return json_build_object('error', 'Not authorized');
  end if;

  if length(coalesce(p_new_password, '')) < 8 then
    return json_build_object('error', 'Password must be at least 8 characters');
  end if;

  select * into v_req
  from public.password_reset_requests
  where id = p_request_id and status = 'pending'
  limit 1;
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
     set status = 'resolved',
         handled_by = v_admin,
         handled_at = now(),
         admin_note = p_admin_note
   where id = p_request_id;

  return json_build_object('ok', true, 'user_id', v_req.user_id, 'email', v_req.email);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Pin search_path on every SECURITY DEFINER function.
--    `extensions` is required for pgcrypto's crypt()/gen_salt()/digest().
--    `pg_temp` is placed last so a caller cannot hijack unqualified names.
-- ---------------------------------------------------------------------------

alter function public.authenticate_user(text, text) set search_path = public, extensions, pg_temp;
alter function public.auto_assign_all_events_organizers() set search_path = public, extensions, pg_temp;
alter function public.change_password(uuid, text, text) set search_path = public, extensions, pg_temp;
alter function public.get_profile_by_email(text, text) set search_path = public, extensions, pg_temp;
alter function public.get_session_user(text) set search_path = public, extensions, pg_temp;
alter function public.is_admin_or_organizer(uuid) set search_path = public, extensions, pg_temp;
alter function public.list_user_sessions(uuid, text) set search_path = public, extensions, pg_temp;
alter function public.record_meeting_presence(uuid, uuid, uuid, integer, boolean) set search_path = public, extensions, pg_temp;
alter function public.register_user(text, text, text, text) set search_path = public, extensions, pg_temp;
alter function public.request_account_deletion(uuid, text, integer) set search_path = public, extensions, pg_temp;
alter function public.request_admin_password_reset(text, text) set search_path = public, extensions, pg_temp;
alter function public.request_password_otp(text) set search_path = public, extensions, pg_temp;
alter function public.request_password_reset(text) set search_path = public, extensions, pg_temp;
alter function public.reset_password_with_token(text, text) set search_path = public, extensions, pg_temp;
alter function public.restore_account(text, text) set search_path = public, extensions, pg_temp;
alter function public.revoke_other_sessions(uuid, text) set search_path = public, extensions, pg_temp;
alter function public.revoke_session(text) set search_path = public, extensions, pg_temp;
alter function public.revoke_session_by_id(uuid, uuid, text) set search_path = public, extensions, pg_temp;
alter function public.session_user_id(text) set search_path = public, extensions, pg_temp;
alter function public.submit_evaluation(uuid, uuid, numeric, boolean, jsonb) set search_path = public, extensions, pg_temp;
alter function public.submit_feedback(uuid, uuid, integer, text) set search_path = public, extensions, pg_temp;
alter function public.user_exists(text, text) set search_path = public, extensions, pg_temp;
alter function public.verify_password_otp(text, text, text) set search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- 3. Explicit deny policy for a table that is only touched by SECURITY
--    DEFINER functions. RLS already denies by default; this documents intent.
-- ---------------------------------------------------------------------------

drop policy if exists "no direct client access" on public.password_reset_tokens;
create policy "no direct client access"
  on public.password_reset_tokens
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

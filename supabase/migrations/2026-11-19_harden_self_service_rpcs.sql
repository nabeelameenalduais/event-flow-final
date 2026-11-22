-- Two more SECURITY DEFINER RPCs accepted caller-supplied ids without proving
-- the caller owned them. Both are reachable with the public publishable key.

-- 1. Meeting presence can mark a ticket as used, so the actor must match the
--    user id being recorded.
drop function if exists public.record_meeting_presence(uuid, uuid, uuid, integer, boolean);

create or replace function public.record_meeting_presence(
  p_event_id uuid,
  p_attendee_id uuid,
  p_user_id uuid,
  p_seconds integer,
  p_session_token text,
  p_visible boolean default true
)
returns json
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_actor uuid;
  v_event record;
  v_total int;
  v_attended boolean;
  v_reg record;
  v_ticket uuid;
  v_minutes int;
begin
  v_actor := public.session_user_id(p_session_token);
  if v_actor is null or v_actor is distinct from p_user_id then
    return json_build_object('error', 'Unauthorized');
  end if;

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

-- 2. Account deletion immediately disables login and revokes all sessions.
--    Only the account owner (or an admin) may request it.
drop function if exists public.request_account_deletion(uuid, text, integer);

create or replace function public.request_account_deletion(
  p_user_id uuid,
  p_reason text,
  p_session_token text,
  p_grace_days integer default 30
)
returns json
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_actor uuid;
  v_role text;
  v_until timestamptz;
begin
  v_actor := public.session_user_id(p_session_token);
  if v_actor is null then
    return json_build_object('error', 'Unauthorized');
  end if;

  if v_actor is distinct from p_user_id then
    select r.name into v_role
    from public.profiles p join public.roles r on r.id = p.role_id
    where p.user_id = v_actor;
    if v_role is distinct from 'admin' then
      return json_build_object('error', 'Not authorized');
    end if;
  end if;

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

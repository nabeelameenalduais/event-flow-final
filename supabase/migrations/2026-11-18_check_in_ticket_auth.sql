-- Harden check-in: resolve the caller from the app's opaque device-session
-- token and require organizer/admin rights for the event being checked.
--
-- The client has no Supabase Auth JWT (the app uses its own sessions), so
-- EXECUTE must stay granted to anon/authenticated. Authorization is enforced
-- inside the function instead — never trust a caller-supplied user id.
--
-- Run in the Supabase SQL Editor after 2026-11-17_ticket_qr_fix.sql.

drop function if exists public.check_in_ticket(uuid, uuid, text, text, uuid);

create or replace function public.check_in_ticket(
  p_ticket_id uuid,
  p_expected_event_id uuid,
  p_mode text,
  p_source text,
  p_session_token text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket tickets%rowtype;
  v_reg registrations%rowtype;
  v_attendance attendance%rowtype;
  v_mode text;
  v_session json;
  v_role text;
  v_user_id uuid;
  v_profile_id uuid;
  v_manages_all boolean;
  v_allowed boolean := false;
begin
  v_session := public.get_session_user(p_session_token);
  if v_session is null or v_session->>'error' is not null then
    return json_build_object('ok', false, 'error', 'unauthorized', 'message', 'Please sign in again');
  end if;

  v_role := v_session->>'role';
  if v_role not in ('admin', 'organizer') then
    return json_build_object('ok', false, 'error', 'unauthorized', 'message', 'Only organizers can check in tickets');
  end if;

  v_user_id := (v_session->'user'->>'id')::uuid;
  v_profile_id := (v_session->'profile'->>'id')::uuid;
  v_manages_all := coalesce((v_session->'profile'->>'manages_all_events')::boolean, false);

  select * into v_ticket from tickets where id = p_ticket_id for update;
  if not found then
    return json_build_object('ok', false, 'error', 'not_found', 'message', 'Ticket not found');
  end if;

  select * into v_reg from registrations where id = v_ticket.registration_id;
  if not found or v_reg.status <> 'confirmed' then
    return json_build_object('ok', false, 'error', 'invalid_registration', 'message', 'This ticket''s registration is not confirmed');
  end if;

  if p_expected_event_id is not null and v_reg.event_id <> p_expected_event_id then
    return json_build_object('ok', false, 'error', 'wrong_event', 'message', 'This ticket is not valid for the event being checked');
  end if;

  if v_role = 'admin' or v_manages_all then
    v_allowed := true;
  elsif exists (
    select 1 from event_organizers eo
    where eo.event_id = v_reg.event_id and eo.user_id = v_user_id
  ) then
    v_allowed := true;
  elsif exists (
    select 1 from events e
    where e.id = v_reg.event_id and e.organizer_id = v_profile_id
  ) then
    v_allowed := true;
  end if;

  if not v_allowed then
    return json_build_object('ok', false, 'error', 'unauthorized', 'message', 'You cannot check in tickets for this event');
  end if;

  if v_ticket.status = 'invalid' then
    return json_build_object('ok', false, 'error', 'invalid_ticket', 'message', 'This ticket is no longer valid');
  end if;

  if exists (select 1 from attendance where ticket_id = p_ticket_id) then
    select * into v_attendance from attendance where ticket_id = p_ticket_id limit 1;
    return json_build_object(
      'ok', false,
      'error', 'already_used',
      'message', 'This ticket has already been used',
      'checkInTime', v_attendance.check_in_time,
      'checkOutTime', v_attendance.check_out_time
    );
  end if;

  if v_ticket.status = 'used' then
    return json_build_object('ok', false, 'error', 'already_used', 'message', 'This ticket has already been used');
  end if;

  v_mode := coalesce(p_mode, v_ticket.attendance_mode, v_reg.attendance_mode, 'in_person');

  insert into attendance (ticket_id, mode, source, verified_by)
  values (p_ticket_id, v_mode, coalesce(p_source, 'manual'), v_user_id)
  returning * into v_attendance;

  update tickets
     set status = 'used',
         verified_by = v_user_id,
         verified_at = now()
   where id = p_ticket_id;

  return json_build_object(
    'ok', true,
    'attendance', json_build_object(
      'id', v_attendance.id,
      'ticketId', v_attendance.ticket_id,
      'checkInTime', v_attendance.check_in_time,
      'checkOutTime', v_attendance.check_out_time,
      'mode', v_attendance.mode,
      'source', v_attendance.source,
      'verifiedBy', v_attendance.verified_by
    )
  );
end;
$$;

revoke all on function public.check_in_ticket(uuid, uuid, text, text, text) from public;
grant execute on function public.check_in_ticket(uuid, uuid, text, text, text) to authenticated, anon;

-- ============================================================
-- Ticket QR fix
--   1. Backfill the encoded payload for tickets created before
--      qr_payload existed (those tickets are otherwise not
--      verifiable at scan time).
--   2. Guarantee one attendance row per ticket.
--   3. Atomic, event-aware check-in via an RPC.
-- Run this in the Supabase SQL Editor after the base schema.
-- ============================================================

-- ----------------------------------------------------------------
-- 1) Backfill qr_payload / attendance_mode from the owning registration.
--    The payload matches EF1: + base64url(JSON) produced by the app.
-- ----------------------------------------------------------------
update public.tickets t
set attendance_mode = coalesce(t.attendance_mode, r.attendance_mode)
from public.registrations r
where r.id = t.registration_id
  and t.attendance_mode is null;

update public.tickets t
set qr_payload = 'EF1:' || rtrim(
      replace(replace(
        replace(
          encode(
            convert_to(
              format(
                '{"v":1,"code":"%s","eventId":"%s","registrationId":"%s","mode":"%s"}',
                t.unique_code,
                r.event_id::text,
                r.id::text,
                coalesce(t.attendance_mode, r.attendance_mode,
                         case when e.event_type = 'online' then 'online' else 'in_person' end)
              ),
              'UTF8'
            ),
            'base64'
          ),
          chr(10), ''
        ),
        '+', '-'
      ),
      '/', '_'
    ),
    '='
  )
from public.registrations r
left join public.events e on e.id = r.event_id
where r.id = t.registration_id
  and (t.qr_payload is null or t.qr_payload = '');

-- ----------------------------------------------------------------
-- 2) One ticket can be checked in at most once (race-proof backstop).
-- ----------------------------------------------------------------
do $$ begin
  alter table public.attendance
    add constraint attendance_ticket_id_key unique (ticket_id);
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------
-- 3) Keep stored payloads in the expected format.
-- ----------------------------------------------------------------
do $$ begin
  alter table public.tickets
    add constraint tickets_qr_payload_format_check
    check (qr_payload is null or qr_payload like 'EF1:%');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------
-- 4) Atomic check-in. Locks the ticket row, verifies the event and
--    registration, then records attendance and consumes the ticket.
--    Returns a JSON result instead of raising so the UI can show a
--    specific "already used" / "wrong event" message.
-- ----------------------------------------------------------------
create or replace function public.check_in_ticket(
  p_ticket_id uuid,
  p_expected_event_id uuid,
  p_mode text,
  p_source text,
  p_verified_by uuid
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
begin
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
  values (p_ticket_id, v_mode, coalesce(p_source, 'manual'), p_verified_by)
  returning * into v_attendance;

  update tickets
     set status = 'used',
         verified_by = coalesce(p_verified_by, verified_by),
         verified_at = case when p_verified_by is not null then now() else verified_at end
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

revoke all on function public.check_in_ticket(uuid, uuid, text, text, uuid) from public;
grant execute on function public.check_in_ticket(uuid, uuid, text, text, uuid) to authenticated, anon;

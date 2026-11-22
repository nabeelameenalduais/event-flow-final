-- Event Requests: secure Data API access and an atomic approval workflow.
--
-- The app authenticates with its own device-session tokens (device_sessions),
-- not with Supabase Auth JWTs. Direct table access is therefore denied and all
-- operations go through SECURITY DEFINER RPCs that validate the session token
-- and enforce roles / status transitions on the server.

-- 1) Notification types used by the event-request workflow.
alter type public.notification_type add value if not exists 'event_request';
alter type public.notification_type add value if not exists 'event_request_update';

-- 2) Shared session + role validation. Never trusts a caller-supplied user id.
create or replace function public.event_requests_auth(
  p_session_token text,
  p_admin_only boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid;
  v_profile_id uuid;
  v_role text;
  v_suspended boolean;
  v_deleted timestamptz;
begin
  v_user_id := public.session_user_id(p_session_token);
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'Unauthorized');
  end if;

  select p.id, r.name, u.suspended, u.deleted_at
    into v_profile_id, v_role, v_suspended, v_deleted
  from public.users u
  join public.profiles p on p.user_id = u.id
  left join public.roles r on r.id = p.role_id
  where u.id = v_user_id;

  if v_profile_id is null or coalesce(v_suspended, false) or v_deleted is not null then
    return jsonb_build_object('ok', false, 'error', 'Unauthorized');
  end if;
  if p_admin_only and v_role is distinct from 'admin' then
    return jsonb_build_object('ok', false, 'error', 'Not authorized');
  end if;

  return jsonb_build_object(
    'ok', true,
    'user_id', v_user_id,
    'profile_id', v_profile_id,
    'role', v_role
  );
end;
$$;

-- 3) Notification helpers. Messages are stored as English source strings and
--    localized at the UI boundary, like every other notification in the app.
create or replace function public.event_requests_notify_admins(p_title text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  insert into public.notifications (user_id, type, message, link)
  select u.id,
         'event_request',
         'New event request "' || p_title || '" from a registered user is waiting for review.',
         '/dashboard/event-requests'
  from public.users u
  join public.profiles p on p.user_id = u.id
  join public.roles r on r.id = p.role_id
  where r.name = 'admin'
    and coalesce(u.suspended, false) = false
    and u.deleted_at is null;
end;
$$;

create or replace function public.event_requests_notify_requester(
  p_request public.event_requests,
  p_status text,
  p_link text
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_message text;
begin
  case p_status
    when 'pending' then
      v_message := 'Your event request "' || p_request.title || '" is pending review.';
    when 'reviewing' then
      v_message := 'An administrator is reviewing your event request "' || p_request.title || '".';
    when 'approved' then
      v_message := 'Your event request "' || p_request.title || '" was approved and a draft event was created.';
    when 'rejected' then
      v_message := 'Your event request "' || p_request.title || '" was not approved.';
    when 'needs_info' then
      v_message := 'More information is needed for your event request "' || p_request.title || '".';
    else
      return;
  end case;

  if p_status in ('rejected', 'needs_info')
     and p_request.admin_notes is not null
     and btrim(p_request.admin_notes) <> '' then
    v_message := v_message || ' Note: ' || p_request.admin_notes;
  end if;

  insert into public.notifications (user_id, type, message, link)
  values (p_request.requester_id, 'event_request_update', v_message, p_link);
end;
$$;

-- 4) List (admin sees everything, requester only their own).
drop function if exists public.event_requests_list(text, text, uuid);
create or replace function public.event_requests_list(
  p_session_token text,
  p_status text default null,
  p_requester_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_auth jsonb;
  v_items jsonb;
begin
  v_auth := public.event_requests_auth(p_session_token, false);
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'error', v_auth->>'error');
  end if;

  select coalesce(
    jsonb_agg(
      to_jsonb(er.*) || jsonb_build_object(
        'requester_name',
          coalesce(
            nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
            u.email
          ),
        'requester_email', u.email
      )
      order by er.created_at desc
    ) filter (where er.id is not null),
    '[]'::jsonb
  )
  into v_items
  from public.event_requests er
  left join public.users u on u.id = er.requester_id
  left join public.profiles p on p.user_id = u.id
  where (v_auth->>'role' = 'admin' or er.requester_id = (v_auth->>'user_id')::uuid)
    and (p_status is null or er.status = p_status)
    and (
      p_requester_id is null
      or (v_auth->>'role' = 'admin' and er.requester_id = p_requester_id)
    );

  return jsonb_build_object('ok', true, 'requests', v_items);
end;
$$;

-- 5) Create. The requester is derived from the session token.
drop function if exists public.event_requests_create(text, jsonb);
create or replace function public.event_requests_create(p_session_token text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_auth jsonb;
  v_row jsonb;
  v_title text := btrim(coalesce(p_payload->>'title', ''));
  v_description text := btrim(coalesce(p_payload->>'description', ''));
  v_event_type text := coalesce(p_payload->>'event_type', 'in_person');
  v_start timestamptz := nullif(p_payload->>'preferred_start', '')::timestamptz;
  v_end timestamptz := nullif(p_payload->>'preferred_end', '')::timestamptz;
begin
  v_auth := public.event_requests_auth(p_session_token, false);
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'error', v_auth->>'error');
  end if;
  if v_title = '' then
    return jsonb_build_object('ok', false, 'error', 'Event title is required');
  end if;
  if v_description = '' then
    return jsonb_build_object('ok', false, 'error', 'Please describe the event');
  end if;
  if v_event_type not in ('in_person', 'online', 'hybrid') then
    return jsonb_build_object('ok', false, 'error', 'Invalid event type');
  end if;
  if v_start is not null and v_end is not null and v_end <= v_start then
    return jsonb_build_object('ok', false, 'error', 'The preferred end date must be after the start date');
  end if;

  insert into public.event_requests (
    requester_id, title, description, category_id, event_type, method,
    target_audience, expected_attendees, trainer_name, trainer_bio, trainer_contact,
    preferred_start, preferred_end, venue_id, estimated_budget, currency_code, attachments
  )
  values (
    (v_auth->>'user_id')::uuid,
    v_title,
    v_description,
    nullif(p_payload->>'category_id', '')::uuid,
    v_event_type,
    coalesce(p_payload->>'method', ''),
    coalesce(p_payload->>'target_audience', ''),
    nullif(p_payload->>'expected_attendees', '')::int,
    coalesce(p_payload->>'trainer_name', ''),
    coalesce(p_payload->>'trainer_bio', ''),
    coalesce(p_payload->>'trainer_contact', ''),
    v_start,
    v_end,
    nullif(p_payload->>'venue_id', '')::uuid,
    nullif(p_payload->>'estimated_budget', '')::numeric,
    coalesce(nullif(p_payload->>'currency_code', ''), 'USD'),
    coalesce(p_payload->'attachments', '[]'::jsonb)
  )
  returning to_jsonb(event_requests.*) into v_row;

  perform public.event_requests_notify_admins(v_title);
  return jsonb_build_object('ok', true, 'request', v_row);
end;
$$;

-- 6) Status change: admin only, with validated transitions and a notification.
drop function if exists public.event_requests_set_status(uuid, text, text, text);
create or replace function public.event_requests_set_status(
  p_request_id uuid,
  p_status text,
  p_session_token text,
  p_admin_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_auth jsonb;
  v_req public.event_requests;
  v_row jsonb;
  v_notes text;
  v_link text;
begin
  v_auth := public.event_requests_auth(p_session_token, true);
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'error', v_auth->>'error');
  end if;
  if p_status not in ('pending', 'reviewing', 'needs_info', 'rejected', 'approved') then
    return jsonb_build_object('ok', false, 'error', 'Invalid status');
  end if;

  select * into v_req from public.event_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Event request not found');
  end if;
  if v_req.status in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'This request is already finalized');
  end if;
  if p_status <> v_req.status and not (
    (v_req.status = 'pending' and p_status in ('reviewing', 'needs_info', 'rejected', 'approved'))
    or (v_req.status = 'reviewing' and p_status in ('needs_info', 'rejected', 'approved'))
    or (v_req.status = 'needs_info' and p_status in ('reviewing', 'rejected', 'approved'))
  ) then
    return jsonb_build_object('ok', false, 'error', 'Invalid status transition');
  end if;

  v_notes := coalesce(p_admin_notes, v_req.admin_notes);
  update public.event_requests
     set status = p_status,
         reviewed_by = (v_auth->>'user_id')::uuid,
         reviewed_at = now(),
         admin_notes = v_notes
   where id = p_request_id
  returning to_jsonb(event_requests.*) into v_row;

  v_req.status := p_status;
  v_req.admin_notes := v_notes;
  v_link := case
    when v_row->>'created_event_id' is not null
      then '/events/' || (v_row->>'created_event_id')
    else '/dashboard/event-requests'
  end;
  perform public.event_requests_notify_requester(v_req, p_status, v_link);
  return jsonb_build_object('ok', true, 'request', v_row);
end;
$$;

-- 7) Approve: event creation + request update + notification in one transaction.
drop function if exists public.event_requests_approve(uuid, text, jsonb, text);
create or replace function public.event_requests_approve(
  p_request_id uuid,
  p_session_token text,
  p_payload jsonb,
  p_admin_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_auth jsonb;
  v_req public.event_requests;
  v_event_id uuid;
  v_row jsonb;
  v_organizer uuid := nullif(p_payload->>'organizer_id', '')::uuid;
  v_category uuid := nullif(p_payload->>'category_id', '')::uuid;
  v_venue uuid := nullif(p_payload->>'venue_id', '')::uuid;
  v_event_type text := coalesce(p_payload->>'event_type', 'in_person');
  v_capacity int := nullif(p_payload->>'capacity', '')::int;
  v_online_capacity int := nullif(p_payload->>'online_capacity', '')::int;
  v_in_person_capacity int := nullif(p_payload->>'in_person_capacity', '')::int;
  v_deadline timestamptz := nullif(p_payload->>'registration_deadline', '')::timestamptz;
  v_start timestamptz := nullif(p_payload->>'start_date', '')::timestamptz;
  v_end timestamptz := nullif(p_payload->>'end_date', '')::timestamptz;
  v_description text;
begin
  v_auth := public.event_requests_auth(p_session_token, true);
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'error', v_auth->>'error');
  end if;

  select * into v_req from public.event_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Event request not found');
  end if;
  if v_req.status in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'This request is already finalized');
  end if;

  if v_organizer is null or not exists (select 1 from public.profiles where id = v_organizer) then
    return jsonb_build_object('ok', false, 'error', 'Select a valid organizer');
  end if;
  if v_category is null or not exists (select 1 from public.categories where id = v_category) then
    return jsonb_build_object('ok', false, 'error', 'Select a valid category');
  end if;
  if v_event_type not in ('in_person', 'online', 'hybrid') then
    return jsonb_build_object('ok', false, 'error', 'Invalid event type');
  end if;
  if v_capacity is null or v_capacity <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Capacity must be greater than zero');
  end if;
  if v_deadline is null or v_start is null or v_end is null
     or v_deadline > v_start or v_start >= v_end then
    return jsonb_build_object('ok', false, 'error', 'Invalid event dates');
  end if;

  v_description := coalesce(nullif(btrim(coalesce(p_payload->>'description', '')), ''), v_req.description);

  insert into public.events (
    title, description, cover_image_url, organizer_id, venue_id, capacity,
    registration_deadline, start_date, end_date, status, visibility,
    contact_email, category_id, event_type, online_capacity, in_person_capacity
  )
  values (
    v_req.title,
    v_description,
    '',
    v_organizer,
    coalesce(v_venue, v_req.venue_id),
    v_capacity,
    v_deadline,
    v_start,
    v_end,
    'draft',
    'private',
    coalesce(nullif(p_payload->>'contact_email', ''), ''),
    v_category,
    v_event_type,
    case when v_event_type = 'hybrid' then coalesce(v_online_capacity, v_capacity) else null end,
    case when v_event_type = 'hybrid' then coalesce(v_in_person_capacity, v_capacity) else null end
  )
  returning id into v_event_id;

  update public.event_requests
     set status = 'approved',
         reviewed_by = (v_auth->>'user_id')::uuid,
         reviewed_at = now(),
         admin_notes = coalesce(p_admin_notes, v_req.admin_notes),
         created_event_id = v_event_id,
         estimated_budget = coalesce(nullif(p_payload->>'estimated_budget', '')::numeric, estimated_budget),
         currency_code = coalesce(nullif(p_payload->>'currency_code', ''), currency_code)
   where id = p_request_id
  returning to_jsonb(event_requests.*) into v_row;

  v_req.status := 'approved';
  v_req.created_event_id := v_event_id;
  v_req.admin_notes := coalesce(p_admin_notes, v_req.admin_notes);
  perform public.event_requests_notify_requester(v_req, 'approved', '/events/' || v_event_id);

  return jsonb_build_object('ok', true, 'request', v_row, 'event_id', v_event_id);
end;
$$;

-- 8) Requester refinement while the request is still open (admin may also edit).
drop function if exists public.event_requests_update(uuid, text, jsonb);
create or replace function public.event_requests_update(
  p_request_id uuid,
  p_session_token text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_auth jsonb;
  v_req public.event_requests;
  v_row jsonb;
  v_start timestamptz;
  v_end timestamptz;
begin
  v_auth := public.event_requests_auth(p_session_token, false);
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'error', v_auth->>'error');
  end if;

  select * into v_req from public.event_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Event request not found');
  end if;
  if v_req.requester_id <> (v_auth->>'user_id')::uuid and v_auth->>'role' <> 'admin' then
    return jsonb_build_object('ok', false, 'error', 'Not authorized');
  end if;
  if v_req.status in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'This request can no longer be edited');
  end if;

  v_start := nullif(p_payload->>'preferred_start', '')::timestamptz;
  v_end := nullif(p_payload->>'preferred_end', '')::timestamptz;
  if v_start is not null and v_end is not null and v_end <= v_start then
    return jsonb_build_object('ok', false, 'error', 'The preferred end date must be after the start date');
  end if;

  update public.event_requests
     set description = coalesce(p_payload->>'description', description),
         preferred_start = coalesce(v_start, preferred_start),
         preferred_end = coalesce(v_end, preferred_end),
         estimated_budget = coalesce(nullif(p_payload->>'estimated_budget', '')::numeric, estimated_budget),
         currency_code = coalesce(nullif(p_payload->>'currency_code', ''), currency_code),
         attachments = coalesce(p_payload->'attachments', attachments)
   where id = p_request_id
  returning to_jsonb(event_requests.*) into v_row;

  return jsonb_build_object('ok', true, 'request', v_row);
end;
$$;

-- 9) Delete (only own open request, or any open request for an admin).
drop function if exists public.event_requests_delete(uuid, text);
create or replace function public.event_requests_delete(p_request_id uuid, p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_auth jsonb;
  v_req public.event_requests;
begin
  v_auth := public.event_requests_auth(p_session_token, false);
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'error', v_auth->>'error');
  end if;

  select * into v_req from public.event_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Event request not found');
  end if;
  if v_req.requester_id <> (v_auth->>'user_id')::uuid and v_auth->>'role' <> 'admin' then
    return jsonb_build_object('ok', false, 'error', 'Not authorized');
  end if;
  if v_req.status = 'approved' then
    return jsonb_build_object('ok', false, 'error', 'Approved requests cannot be deleted');
  end if;

  delete from public.event_requests where id = p_request_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- 10) Internal helpers must not be callable directly by API roles.
revoke all on function public.event_requests_auth(text, boolean) from public;
revoke all on function public.event_requests_notify_admins(text) from public;
revoke all on function public.event_requests_notify_requester(public.event_requests, text, text) from public;

-- 11) RPCs are reachable with the app's publishable key (role `anon`).
revoke all on function public.event_requests_list(text, text, uuid) from public;
grant execute on function public.event_requests_list(text, text, uuid) to anon, authenticated;

revoke all on function public.event_requests_create(text, jsonb) from public;
grant execute on function public.event_requests_create(text, jsonb) to anon, authenticated;

revoke all on function public.event_requests_set_status(uuid, text, text, text) from public;
grant execute on function public.event_requests_set_status(uuid, text, text, text) to anon, authenticated;

revoke all on function public.event_requests_approve(uuid, text, jsonb, text) from public;
grant execute on function public.event_requests_approve(uuid, text, jsonb, text) to anon, authenticated;

revoke all on function public.event_requests_update(uuid, text, jsonb) from public;
grant execute on function public.event_requests_update(uuid, text, jsonb) to anon, authenticated;

revoke all on function public.event_requests_delete(uuid, text) from public;
grant execute on function public.event_requests_delete(uuid, text) to anon, authenticated;

-- 12) Defense in depth: no direct Data API access to the table. The previous
--     permissive policy is removed; SECURITY DEFINER functions run as the owner
--     and service_role bypasses RLS.
drop policy if exists event_requests_all on public.event_requests;
drop policy if exists "no direct client access" on public.event_requests;
create policy "no direct client access"
  on public.event_requests
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

notify pgrst, 'reload schema';

-- Bans: secure Data API access through session-validated RPCs.
--
-- The app authenticates with its own device-session tokens, not with Supabase
-- Auth JWTs. Direct table access stays denied; all ban operations go through
-- SECURITY DEFINER RPCs that validate the session token and enforce roles.

-- 1) Notification types used by the ban workflow.
alter type public.notification_type add value if not exists 'ban_notice';
alter type public.notification_type add value if not exists 'ban_request';
alter type public.notification_type add value if not exists 'ban_approved';

-- 2) Shared session + role validation. Never trusts a caller-supplied user id.
drop function if exists public.bans_auth(text, boolean);
create or replace function public.bans_auth(
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

-- Managers are admins and organizers. Attendees may only use the registration
-- check below; they cannot open or change ban records.
drop function if exists public.bans_auth_manager(text);
create or replace function public.bans_auth_manager(p_session_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_auth jsonb;
begin
  v_auth := public.bans_auth(p_session_token, false);
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;
  if v_auth->>'role' not in ('admin', 'organizer') then
    return jsonb_build_object('ok', false, 'error', 'Not authorized');
  end if;
  return v_auth;
end;
$$;

-- 3) Notification helper. Messages are stored as English source strings and
--    localized at the UI boundary, like every other notification in the app.
drop function if exists public.bans_notify_admins(text);
create or replace function public.bans_notify_admins(p_message text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  insert into public.notifications (user_id, type, message, link)
  select u.id,
         'ban_request',
         p_message,
         '/dashboard/bans'
  from public.users u
  join public.profiles p on p.user_id = u.id
  join public.roles r on r.id = p.role_id
  where r.name = 'admin'
    and coalesce(u.suspended, false) = false
    and u.deleted_at is null;
end;
$$;

-- 4) Ban descriptions shared by notifications and error messages.
drop function if exists public.bans_describe_scope(text);
create or replace function public.bans_describe_scope(p_scope text)
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select case p_scope
    when 'global' then 'a global ban'
    when 'event' then 'a ban for this event'
    else 'a ban in this event category'
  end;
$$;

-- 5) Page data: admins see everything, organizers only their own requests.
--    User options are deliberately minimal and exclude inactive accounts.
drop function if exists public.bans_page_data(text);
create or replace function public.bans_page_data(p_session_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_auth jsonb;
  v_result jsonb;
begin
  v_auth := public.bans_auth_manager(p_session_token);
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'error', v_auth->>'error');
  end if;

  select jsonb_build_object(
    'ok', true,
    'bans', (
      select coalesce(
        jsonb_agg(
          to_jsonb(b.*) || jsonb_build_object(
            'user_name',
              coalesce(nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), u.email),
            'user_email', u.email,
            'event_title', e.title,
            'category_name', c.name
          )
          order by b.created_at desc
        ) filter (where b.id is not null),
        '[]'::jsonb
      )
      from public.user_bans b
      left join public.users u on u.id = b.user_id
      left join public.profiles p on p.user_id = u.id
      left join public.events e on e.id = b.event_id
      left join public.categories c on c.id = b.category_id
      where (v_auth->>'role' = 'admin' or b.requested_by = (v_auth->>'user_id')::uuid)
    ),
    'revoke_requests', (
      select coalesce(
        jsonb_agg(to_jsonb(br.*) order by br.created_at desc) filter (where br.id is not null),
        '[]'::jsonb
      )
      from public.ban_revoke_requests br
      where v_auth->>'role' = 'admin'
    ),
    'users', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', u.id,
            'email', u.email,
            'name', coalesce(nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), u.email)
          )
          order by u.created_at desc
        ) filter (where u.id is not null),
        '[]'::jsonb
      )
      from public.users u
      left join public.profiles p on p.user_id = u.id
      where coalesce(u.suspended, false) = false and u.deleted_at is null
    ),
    'events', (
      select coalesce(
        jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title) order by e.title) filter (where e.id is not null),
        '[]'::jsonb
      )
      from public.events e
    ),
    'categories', (
      select coalesce(
        jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name) filter (where c.id is not null),
        '[]'::jsonb
      )
      from public.categories c
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- 6) Registration summary for the ban confirmation panel.
drop function if exists public.bans_registration_summary(text, uuid);
create or replace function public.bans_registration_summary(
  p_session_token text,
  p_user_id uuid
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
  v_auth := public.bans_auth_manager(p_session_token);
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'error', v_auth->>'error');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'event_id', r.event_id,
        'event_title', coalesce(e.title, 'Unknown event'),
        'status', r.status::text,
        'registered_at', r.registered_at
      )
      order by r.registered_at desc
    ) filter (where r.id is not null),
    '[]'::jsonb
  )
  into v_items
  from public.registrations r
  join public.profiles p on p.id = r.attendee_id
  left join public.events e on e.id = r.event_id
  where p.user_id = p_user_id;

  return jsonb_build_object('ok', true, 'registrations', v_items);
end;
$$;

-- 7) Registration guard. This is callable by any signed-in user because it is
--    used during event registration; the target user comes from the session.
drop function if exists public.bans_check_registration(text, uuid, uuid);
create or replace function public.bans_check_registration(
  p_session_token text,
  p_event_id uuid,
  p_category_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_auth jsonb;
  v_ban public.user_bans;
begin
  v_auth := public.bans_auth(p_session_token, false);
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'error', v_auth->>'error');
  end if;

  select b.*
    into v_ban
  from public.user_bans b
  where b.user_id = (v_auth->>'user_id')::uuid
    and b.status = 'active'
    and (b.is_permanent or b.expires_at is null or b.expires_at > now())
    and (
      b.scope = 'global'
      or (b.scope = 'event' and b.event_id = p_event_id)
      or (b.scope = 'category' and b.category_id = p_category_id)
    )
  order by case b.scope when 'global' then 1 when 'event' then 2 else 3 end
  limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'ban', null);
  end if;

  return jsonb_build_object('ok', true, 'ban', to_jsonb(v_ban));
end;
$$;

-- 8) Create. Admins create active bans immediately; organizer requests start
--    pending and notify administrators with the existing-registration note.
drop function if exists public.bans_create(text, jsonb);
create or replace function public.bans_create(p_session_token text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_auth jsonb;
  v_scope text := btrim(coalesce(p_payload->>'scope', ''));
  v_event_id uuid := nullif(p_payload->>'event_id', '')::uuid;
  v_category_id uuid := nullif(p_payload->>'category_id', '')::uuid;
  v_target_user_id uuid := nullif(p_payload->>'user_id', '')::uuid;
  v_reason text := btrim(coalesce(p_payload->>'reason', ''));
  v_is_permanent boolean := coalesce((p_payload->>'is_permanent')::boolean, true);
  v_expires_at timestamptz := nullif(p_payload->>'expires_at', '')::timestamptz;
  v_notify_user boolean := coalesce((p_payload->>'notify_user')::boolean, true);
  v_is_admin boolean;
  v_row jsonb;
  v_registration_count int;
  v_registration_note text;
begin
  v_auth := public.bans_auth_manager(p_session_token);
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'error', v_auth->>'error');
  end if;
  v_is_admin := v_auth->>'role' = 'admin';

  if v_scope not in ('global', 'event', 'category') then
    return jsonb_build_object('ok', false, 'error', 'Invalid ban scope');
  end if;
  if v_target_user_id is null or not exists (select 1 from public.users where id = v_target_user_id) then
    return jsonb_build_object('ok', false, 'error', 'Select a valid user');
  end if;
  if v_scope = 'event' and (v_event_id is null or not exists (select 1 from public.events where id = v_event_id)) then
    return jsonb_build_object('ok', false, 'error', 'Choose the event for this ban');
  end if;
  if v_scope = 'category' and (v_category_id is null or not exists (select 1 from public.categories where id = v_category_id)) then
    return jsonb_build_object('ok', false, 'error', 'Choose the category for this ban');
  end if;
  if v_reason = '' then
    return jsonb_build_object('ok', false, 'error', 'A reason is required');
  end if;
  if not v_is_permanent and v_expires_at is null then
    return jsonb_build_object('ok', false, 'error', 'A valid end date is required');
  end if;

  insert into public.user_bans (
    user_id, scope, event_id, category_id, reason, is_permanent, expires_at,
    notify_user, status, requested_by, approved_by, approved_at
  )
  values (
    v_target_user_id,
    v_scope,
    case when v_scope = 'event' then v_event_id else null end,
    case when v_scope = 'category' then v_category_id else null end,
    v_reason,
    v_is_permanent,
    case when v_is_permanent then null else v_expires_at end,
    v_notify_user,
    case when v_is_admin then 'active' else 'pending' end,
    (v_auth->>'user_id')::uuid,
    case when v_is_admin then (v_auth->>'user_id')::uuid else null end,
    case when v_is_admin then now() else null end
  )
  returning to_jsonb(user_bans.*) into v_row;

  if not v_is_admin then
    select count(*)::int
      into v_registration_count
    from public.registrations r
    join public.profiles p on p.id = r.attendee_id
    where p.user_id = v_target_user_id;

    if v_registration_count = 0 then
      v_registration_note := ' The user has no existing registrations.';
    else
      v_registration_note := ' The user currently has ' || v_registration_count || ' existing registration'
        || case when v_registration_count = 1 then '' else 's' end || ' that will not be cancelled.';
    end if;

    perform public.bans_notify_admins(
      'An organizer requested ' || public.bans_describe_scope(v_scope)
      || ' for a user. Approval is required before it takes effect.' || v_registration_note
    );
  end if;

  return jsonb_build_object('ok', true, 'ban', v_row);
end;
$$;

-- 9) Approve or reject a pending organizer request (admin only).
drop function if exists public.bans_decide(uuid, text, text);
create or replace function public.bans_decide(
  p_ban_id uuid,
  p_decision text,
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_auth jsonb;
  v_ban public.user_bans;
  v_row jsonb;
begin
  v_auth := public.bans_auth(p_session_token, true);
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'error', v_auth->>'error');
  end if;
  if p_decision not in ('approve', 'reject') then
    return jsonb_build_object('ok', false, 'error', 'Invalid decision');
  end if;

  select * into v_ban from public.user_bans where id = p_ban_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Ban not found');
  end if;
  if v_ban.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'This ban request is already finalized');
  end if;

  update public.user_bans
     set status = case when p_decision = 'approve' then 'active' else 'rejected' end,
         approved_by = (v_auth->>'user_id')::uuid,
         approved_at = now()
   where id = p_ban_id
  returning to_jsonb(user_bans.*) into v_row;

  return jsonb_build_object('ok', true, 'ban', v_row);
end;
$$;

-- 10) Lift an active ban (admin only).
drop function if exists public.bans_revoke(uuid, text, text);
create or replace function public.bans_revoke(
  p_ban_id uuid,
  p_reason text,
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_auth jsonb;
  v_ban public.user_bans;
  v_row jsonb;
begin
  v_auth := public.bans_auth(p_session_token, true);
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'error', v_auth->>'error');
  end if;

  select * into v_ban from public.user_bans where id = p_ban_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Ban not found');
  end if;
  if v_ban.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'Only active bans can be lifted');
  end if;

  update public.user_bans
     set status = 'revoked',
         revoked_by = (v_auth->>'user_id')::uuid,
         revoked_at = now(),
         revoke_reason = p_reason
   where id = p_ban_id
  returning to_jsonb(user_bans.*) into v_row;

  return jsonb_build_object('ok', true, 'ban', v_row);
end;
$$;

-- 11) Organizer lift request. Organizers may only request a lift for a ban
--     they submitted themselves.
drop function if exists public.bans_request_revoke(uuid, text, text);
create or replace function public.bans_request_revoke(
  p_ban_id uuid,
  p_reason text,
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_auth jsonb;
  v_ban public.user_bans;
  v_row jsonb;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  v_auth := public.bans_auth_manager(p_session_token);
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'error', v_auth->>'error');
  end if;
  if v_auth->>'role' <> 'organizer' then
    return jsonb_build_object('ok', false, 'error', 'Not authorized');
  end if;
  if v_reason = '' then
    return jsonb_build_object('ok', false, 'error', 'Please explain why the ban should be lifted');
  end if;

  select * into v_ban from public.user_bans where id = p_ban_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Ban not found');
  end if;
  if v_ban.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'Only active bans can be lifted');
  end if;
  if v_ban.requested_by is distinct from (v_auth->>'user_id')::uuid then
    return jsonb_build_object('ok', false, 'error', 'Not authorized');
  end if;

  insert into public.ban_revoke_requests (ban_id, requested_by, reason, status)
  values (p_ban_id, (v_auth->>'user_id')::uuid, v_reason, 'pending')
  returning to_jsonb(ban_revoke_requests.*) into v_row;

  perform public.bans_notify_admins(
    'An organizer requested to lift a user ban. Review it on the Bans page.'
  );

  return jsonb_build_object('ok', true, 'request', v_row);
end;
$$;

-- 12) Decide a lift request. Approval revokes the ban and updates the request
--     in one transaction, so a partial approval cannot be left behind.
drop function if exists public.bans_decide_revoke(uuid, text, text);
create or replace function public.bans_decide_revoke(
  p_request_id uuid,
  p_decision text,
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_auth jsonb;
  v_request public.ban_revoke_requests;
  v_ban public.user_bans;
  v_request_row jsonb;
  v_ban_row jsonb;
begin
  v_auth := public.bans_auth(p_session_token, true);
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'error', v_auth->>'error');
  end if;
  if p_decision not in ('approve', 'reject') then
    return jsonb_build_object('ok', false, 'error', 'Invalid decision');
  end if;

  select * into v_request from public.ban_revoke_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Request not found');
  end if;
  if v_request.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'This lift request is already handled');
  end if;

  select * into v_ban from public.user_bans where id = v_request.ban_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Ban not found');
  end if;

  if p_decision = 'approve' then
    update public.user_bans
       set status = 'revoked',
           revoked_by = (v_auth->>'user_id')::uuid,
           revoked_at = now(),
           revoke_reason = coalesce(nullif(btrim(v_request.reason), ''), 'Approved revocation request')
     where id = v_ban.id
    returning to_jsonb(user_bans.*) into v_ban_row;
  end if;

  update public.ban_revoke_requests
     set status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
         handled_by = (v_auth->>'user_id')::uuid,
         handled_at = now()
   where id = p_request_id
  returning to_jsonb(ban_revoke_requests.*) into v_request_row;

  return jsonb_build_object('ok', true, 'request', v_request_row, 'ban', v_ban_row);
end;
$$;

-- 13) Internal helpers must not be callable directly by API roles.
revoke all on function public.bans_auth(text, boolean) from public;
revoke all on function public.bans_auth_manager(text) from public;
revoke all on function public.bans_notify_admins(text) from public;
revoke all on function public.bans_describe_scope(text) from public;

-- 14) RPCs are reachable with the app's publishable key (role `anon`).
revoke all on function public.bans_page_data(text) from public;
grant execute on function public.bans_page_data(text) to anon, authenticated;

revoke all on function public.bans_registration_summary(text, uuid) from public;
grant execute on function public.bans_registration_summary(text, uuid) to anon, authenticated;

revoke all on function public.bans_check_registration(text, uuid, uuid) from public;
grant execute on function public.bans_check_registration(text, uuid, uuid) to anon, authenticated;

revoke all on function public.bans_create(text, jsonb) from public;
grant execute on function public.bans_create(text, jsonb) to anon, authenticated;

revoke all on function public.bans_decide(uuid, text, text) from public;
grant execute on function public.bans_decide(uuid, text, text) to anon, authenticated;

revoke all on function public.bans_revoke(uuid, text, text) from public;
grant execute on function public.bans_revoke(uuid, text, text) to anon, authenticated;

revoke all on function public.bans_request_revoke(uuid, text, text) from public;
grant execute on function public.bans_request_revoke(uuid, text, text) to anon, authenticated;

revoke all on function public.bans_decide_revoke(uuid, text, text) from public;
grant execute on function public.bans_decide_revoke(uuid, text, text) to anon, authenticated;

-- 15) Defense in depth: no direct Data API access to ban tables. SECURITY
--     DEFINER functions run as the owner and service_role bypasses RLS.
drop policy if exists user_bans_all on public.user_bans;
drop policy if exists ban_revoke_requests_all on public.ban_revoke_requests;
drop policy if exists "no direct client access" on public.user_bans;
drop policy if exists "no direct client access" on public.ban_revoke_requests;

create policy "no direct client access"
  on public.user_bans
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "no direct client access"
  on public.ban_revoke_requests
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

notify pgrst, 'reload schema';

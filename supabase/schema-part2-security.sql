-- ---------------------------------------------------------------------------
-- SECURITY HARDENING — run this AFTER schema.sql (idempotent, safe to re-run)
--
-- The original database granted anon/authenticated TABLE-level privileges on
-- every table (including via ALTER DEFAULT PRIVILEGES, so even new tables were
-- open). Table-level grants override the column-level revokes in schema.sql,
-- which is why password hashes and session tokens remained readable.
--
-- What this fixes:
--   * password_reset_tokens  -> any client could read/create reset tokens and
--                               hijack any account. The app never queries this
--                               table directly (only the security-definer
--                               RPCs), so it is closed completely.
--   * auth_attempts          -> RPC-only bookkeeping; closed completely.
--   * users.password_hash    -> still insertable (account creation) but no
--                               longer readable or updatable by the client.
--   * device_sessions.token  -> still insertable (session creation) but no
--                               longer readable or updatable by the client.
--   * future tables/function -> stop auto-granting access to the client.
--
-- All auth flows run through SECURITY DEFINER RPCs (authenticate_user,
-- register_user, get_session_user, revoke_session, list_user_sessions,
-- request_password_reset, reset_password_with_token, ...) and are unaffected.
-- ---------------------------------------------------------------------------

-- 1) Future-proofing: stop auto-granting the client access to new objects.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on tables from authenticated;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke execute on functions from authenticated;

-- 2) Password-reset tokens are credentials; close the table to the client.
revoke all on public.password_reset_tokens from anon;
revoke all on public.password_reset_tokens from authenticated;

-- 3) Login-attempt bookkeeping is RPC-only; not needed by the client.
revoke all on public.auth_attempts from anon;
revoke all on public.auth_attempts from authenticated;

-- 4) users: password_hash must never be readable or updatable by the client.
revoke all on public.users from anon;
revoke all on public.users from authenticated;
grant select (id, email, suspended, created_at, updated_at) on public.users to anon, authenticated;
grant insert (id, email, password_hash, suspended, created_at, updated_at) on public.users to anon, authenticated;
grant update (suspended, updated_at) on public.users to anon, authenticated;

-- 5) device_sessions: tokens are credentials; the client may insert them but
--    never read or change them (sessions are revoked via the RPCs above).
revoke all on public.device_sessions from anon;
revoke all on public.device_sessions from authenticated;
grant insert (id, user_id, device_name, ip_address, token, last_active_at, created_at) on public.device_sessions to anon, authenticated;
grant select (id, user_id, device_name, ip_address, last_active_at, created_at) on public.device_sessions to anon, authenticated;
grant update (last_active_at) on public.device_sessions to anon, authenticated;

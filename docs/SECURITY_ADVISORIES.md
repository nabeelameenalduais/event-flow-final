# Supabase advisor follow-up (2026-11-19)

EventFlow authenticates with its own session tokens stored in `device_sessions`,
not with Supabase Auth JWTs. The app reaches PostgREST with the publishable
key, so `anon`/`authenticated` must be able to call our RPCs; authorization is
performed *inside* each `SECURITY DEFINER` function from a `p_session_token`.
That is why some advisor findings are accepted rather than "fixed" by revoking
execute privileges.

## Fixed and applied live

| Finding | Before | After | Change |
| --- | --- | --- | --- |
| `unindexed_foreign_keys` | 50 | 0 | Added covering indexes for every unindexed FK leading column in `public`. |
| `duplicate_index` | 8 | 0 | Dropped exact duplicate indexes, keeping the constraint-backed/canonical one. |
| `function_search_path_mutable` | 26 | 0 | Pinned `search_path = public, extensions, pg_temp` on all SECURITY DEFINER functions. `extensions` is required for pgcrypto; `pg_temp` is last. |
| `rls_enabled_no_policy` | 1 | 0 | Added an explicit restrictive deny-all policy on `password_reset_tokens` (only touched by SECURITY DEFINER code). |

Additionally, a live audit found three **critical** unauthenticated admin RPCs
(`admin_set_password`, `admin_restore_account`, `resolve_admin_password_reset`)
that accepted a caller-supplied `p_admin_id` without verifying it. Any anonymous
caller could have reset any user's password. Two self-service RPCs had the same
shape: `request_account_deletion` locked users out immediately and
`record_meeting_presence` could mark a ticket as used. All five now derive the
actor from a validated session token and return `Unauthorized` otherwise.

Migrations:
- `supabase/migrations/2026-11-19_security_hardening.sql`
- `supabase/migrations/2026-11-19_harden_self_service_rpcs.sql`
- `supabase/migrations/2026-11-19_index_maintenance.sql`

Live probes confirmed that bogus tokens return `{"error":"Unauthorized"}` and
leave passwords, deletion state, and attendance untouched.

## Remaining findings (accepted / informational)

- **`unused_index` (90, INFO)** — [linter docs](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
  Around 50 of these are the newly created FK indexes; usage statistics need
  time to accumulate. The rest predate this work. They are left in place because
  they cover FK cascade/join lookups; dropping them would reintroduce the FK
  advisory.

- **`multiple_permissive_policies` (80, WARN)** — [linter docs](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies).
  Permissive policies are combined with OR. Rewriting them as restrictive would
  change the data-access model for every table and is out of scope for this
  cleanup. Authorization for privileged operations is enforced in the RPCs.

- **`anon_security_definer_function_executable` / `authenticated_security_definer_function_executable` (28 each, WARN)** —
  [anon docs](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
  [authenticated docs](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
  Required by the custom-session architecture. The dangerous entry points have
  been hardened as described above; the remaining public functions are either
  login/registration flows (password/OTP proof) or low-impact helpers.

## Known residual risk

`submit_feedback`, `submit_evaluation`, and `auto_assign_all_events_organizers`
still accept caller-supplied ids without a session token. They are low impact
(feedback/evaluation require an attended registration; the organizer mapper is
a trigger), but hardening them would require another coordinated client +
database signature change.

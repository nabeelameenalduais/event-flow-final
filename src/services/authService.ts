import { supabase } from "../lib/supabase"
import { sha256 } from "js-sha256"
import type { User, Profile, RoleName } from "../types"
import { withRateLimit } from "./rateLimit"
import { logAction } from "./auditService"
import { isMissingFunction } from "../lib/supabaseErrors"

interface AuthResult {
  user: User
  profile: Profile
  role: RoleName
}

function parseAuthResult(result: any): AuthResult {
  if (!result || result.error) {
    throw new Error(result?.error ?? "Authentication failed")
  }
  return {
    user: {
      id: result.user.id,
      email: result.user.email,
      createdAt: result.user.created_at,
      updatedAt: result.user.updated_at,
      suspended: result.user.suspended ?? undefined,
      mustChangePassword: result.user.must_change_password ?? false,
      deletedAt: result.user.deleted_at ?? undefined,
      scheduledDeletionAt: result.user.scheduled_deletion_at ?? undefined,
      deletionReason: result.user.deletion_reason ?? undefined,
    },
    profile: {
      id: result.profile.id,
      userId: result.profile.user_id,
      firstName: result.profile.first_name,
      lastName: result.profile.last_name,
      phoneNumber: result.profile.phone_number,
      avatarUrl: result.profile.avatar_url,
      roleId: result.profile.role_id,
      managesAllEvents: result.profile.manages_all_events ?? false,
    },
    role: result.role as RoleName,
  }
}

const LEGACY_SESSION_KEY = "eventflow_session_legacy"
const UNAVAILABLE = "This feature is not available yet — the database schema has not been upgraded"

// ---------------------------------------------------------------------------
// Legacy (pre-schema) support.
//
// The live database still runs the original schema: it has no RPC functions
// and no new tables, but it exposes users/profiles/roles to the anon key and
// the stored password hashes are plain SHA-256. When a server-side function
// is missing (PGRST202) the app falls back to the original client-side flow
// so login keeps working. Once supabase/schema.sql is applied to the project,
// the RPC paths below take over and this code is never used.
// ---------------------------------------------------------------------------

interface LegacyProfileRow {
  id: string
  first_name?: string
  last_name?: string
  phone_number?: string
  avatar_url?: string
  role_id?: string
  roles?: { id: string; name: RoleName } | { id: string; name: RoleName }[]
}

interface LegacyUserRow {
  id: string
  email: string
  password_hash?: string
  suspended?: boolean
  created_at?: string
  updated_at?: string
  profiles?: LegacyProfileRow | LegacyProfileRow[]
}

const PROFILE_SELECT = "profiles(id, first_name, last_name, phone_number, avatar_url, role_id, roles(id, name))"

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function legacyToAuthResult(row: LegacyUserRow): AuthResult {
  const p = asArray(row.profiles)[0]
  return {
    user: {
      id: row.id,
      email: row.email,
      createdAt: row.created_at ?? "",
      updatedAt: row.updated_at ?? "",
      suspended: row.suspended ?? false,
    },
    profile: {
      id: p?.id ?? row.id,
      userId: row.id,
      firstName: p?.first_name ?? "",
      lastName: p?.last_name ?? "",
      phoneNumber: p?.phone_number ?? "",
      avatarUrl: p?.avatar_url ?? "",
      roleId: p?.role_id ?? "",
      managesAllEvents: false,
    },
    role: asArray(p?.roles)[0]?.name ?? "attendee",
  }
}

function readLegacySession(): AuthResult | null {
  if (typeof localStorage === "undefined") return null
  try {
    const raw = localStorage.getItem(LEGACY_SESSION_KEY)
    return raw ? (JSON.parse(raw) as AuthResult) : null
  } catch {
    return null
  }
}

function persistLegacySession(result: AuthResult): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify(result))
  } catch {
    // ignore storage failures
  }
}

function clearLegacySession(): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.removeItem(LEGACY_SESSION_KEY)
  } catch {
    // ignore storage failures
  }
}

async function fetchLegacyUserByEmail(email: string): Promise<LegacyUserRow | null> {
  const { data, error } = await supabase
    .from("users")
    .select(`id, email, password_hash, suspended, created_at, updated_at, ${PROFILE_SELECT}`)
    .ilike("email", email.trim())
    .maybeSingle()
  if (error) throw new Error("Invalid email or password")
  return (data as LegacyUserRow) ?? null
}

async function fetchLegacyUserById(id: string): Promise<LegacyUserRow | null> {
  const { data, error } = await supabase
    .from("users")
    .select(`id, email, suspended, created_at, updated_at, ${PROFILE_SELECT}`)
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error("Session expired")
  return (data as LegacyUserRow) ?? null
}

async function legacyLogin(email: string, password: string): Promise<AuthResult> {
  const row = await fetchLegacyUserByEmail(email)
  if (!row?.password_hash) throw new Error("Invalid email or password")
  if (sha256(password).toLowerCase() !== row.password_hash.toLowerCase()) {
    throw new Error("Invalid email or password")
  }
  if (row.suspended) throw new Error("Account suspended")
  const result = legacyToAuthResult(row)
  persistLegacySession(result)
  logAction(result.user.id, "login", "user", result.user.id, "Logged in").catch(() => {})
  return result
}

async function legacyRegister(email: string, password: string, firstName: string, lastName: string): Promise<AuthResult> {
  const { data: roleRow } = await supabase.from("roles").select("id").eq("name", "attendee").maybeSingle()
  if (!roleRow) throw new Error("Registration failed")

  const { error: userError } = await supabase
    .from("users")
    .insert({ email: email.trim().toLowerCase(), password_hash: sha256(password) })
  if (userError) throw new Error(userError.message ?? "Registration failed")

  const { data: user, error: selectError } = await supabase
    .from("users")
    .select("id, email, created_at, updated_at, suspended")
    .eq("email", email.trim().toLowerCase())
    .single()
  if (selectError || !user) throw new Error("Registration failed")

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      user_id: user.id,
      first_name: firstName,
      last_name: lastName,
      phone_number: "",
      avatar_url: "",
      role_id: roleRow.id,
    })
    .select("id, user_id, first_name, last_name, phone_number, avatar_url, role_id")
    .single()
  if (profileError || !profile) throw new Error("Registration failed")

  const result: AuthResult = {
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at ?? new Date().toISOString(),
      updatedAt: user.updated_at ?? new Date().toISOString(),
      suspended: user.suspended ?? false,
    },
    profile: {
      id: profile.id,
      userId: profile.user_id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      phoneNumber: profile.phone_number ?? "",
      avatarUrl: profile.avatar_url ?? "",
      roleId: profile.role_id,
      managesAllEvents: false,
    },
    role: "attendee",
  }
  persistLegacySession(result)
  logAction(result.user.id, "register", "user", result.user.id, "Account registered").catch(() => {})
  return result
}

async function legacyRestoreSession(): Promise<AuthResult> {
  const snapshot = readLegacySession()
  if (!snapshot) throw new Error("Session expired")
  const row = await fetchLegacyUserById(snapshot.user.id)
  if (!row || row.suspended) {
    clearLegacySession()
    throw new Error("Session expired")
  }
  return {
    user: {
      id: row.id,
      email: row.email,
      createdAt: row.created_at ?? snapshot.user.createdAt,
      updatedAt: row.updated_at ?? snapshot.user.updatedAt,
      suspended: row.suspended ?? false,
    },
    profile: snapshot.profile,
    role: snapshot.role,
  }
}

async function legacyGetProfileByEmail(email: string): Promise<AuthResult> {
  const row = await fetchLegacyUserByEmail(email)
  if (!row) throw new Error("User not found")
  return legacyToAuthResult(row)
}

async function legacyCheckUserExists(email: string): Promise<boolean> {
  const { data } = await supabase.from("users").select("id").ilike("email", email.trim()).maybeSingle()
  return !!data
}

// Password is verified server-side (bcrypt + per-user salt). The password_hash
// column is never read from the client (see RLS in schema.sql). On the legacy
// database the missing RPC is detected and the original SHA-256 flow is used.
export async function login(email: string, password: string): Promise<AuthResult> {
  return withRateLimit(`login:${email.toLowerCase()}`, async () => {
    const { data, error } = await supabase.rpc("authenticate_user", {
      p_email: email,
      p_password: password,
    })
    if (isMissingFunction(error)) return legacyLogin(email, password)
    if (error || !data || data.error) {
      throw new Error(data?.error ?? error?.message ?? "Invalid email or password")
    }
    const result = parseAuthResult(data)
    logAction(result.user.id, "login", "user", result.user.id, "Logged in").catch(() => {})
    return result
  })
}

export async function getProfileByEmail(email: string): Promise<AuthResult> {
  const { data, error } = await supabase.rpc("get_profile_by_email", {
    p_email: email,
  })
  if (isMissingFunction(error)) return legacyGetProfileByEmail(email)
  if (error) throw new Error("User not found")
  return parseAuthResult(data)
}

export async function register(email: string, password: string, firstName: string, lastName: string): Promise<AuthResult> {
  return withRateLimit(`register:${email.toLowerCase()}`, async () => {
    const { data, error } = await supabase.rpc("register_user", {
      p_email: email,
      p_password: password,
      p_first_name: firstName,
      p_last_name: lastName,
    })
    if (isMissingFunction(error)) return legacyRegister(email, password, firstName, lastName)
    if (error || !data || data.error) throw new Error(data?.error ?? error?.message ?? "Registration failed")
    const result = parseAuthResult(data)
    logAction(result.user.id, "register", "user", result.user.id, "Account registered").catch(() => {})
    return result
  })
}

export async function restoreSession(token: string): Promise<AuthResult> {
  const { data, error } = await supabase.rpc("get_session_user", {
    p_token: token,
  })
  if (isMissingFunction(error)) return legacyRestoreSession()
  if (error) throw new Error("Session expired")
  return parseAuthResult(data)
}

export async function revokeSession(token: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("revoke_session", {
    p_token: token,
  })
  if (isMissingFunction(error)) {
    clearLegacySession()
    return true
  }
  if (error) throw error
  logAction("", "logout", "session", "", "Signed out").catch(() => {})
  return !!data
}

export async function checkUserExists(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("user_exists", { p_email: email })
  if (isMissingFunction(error)) return legacyCheckUserExists(email)
  if (!error && typeof data === "boolean") return data
  return false
}

export interface PasswordResetRequest {
  ok: boolean
  token?: string
  expiresAt?: string
  error?: string
}

export async function requestPasswordReset(email: string): Promise<PasswordResetRequest> {
  const { data, error } = await supabase.rpc("request_password_reset", { p_email: email })
  if (isMissingFunction(error)) throw new Error(UNAVAILABLE)
  if (error || !data) throw new Error(error?.message ?? "Failed to request password reset")
  return data as PasswordResetRequest
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  const { data, error } = await supabase.rpc("reset_password_with_token", {
    p_token: token,
    p_new_password: newPassword,
  })
  if (isMissingFunction(error)) throw new Error(UNAVAILABLE)
  if (error || !data || data.error) {
    throw new Error(data?.error ?? error?.message ?? "Failed to reset password")
  }
}

import { supabase } from "../lib/supabase"
import type { User, Profile, RoleName } from "../types"
import { sha256 } from "js-sha256"

interface UserWithProfile extends User {
  profile: Profile | undefined
  roleName: RoleName | undefined
}

interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function mapUser(row: Record<string, any>): UserWithProfile {
  const p = row.profile
  return {
    id: row.id,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    suspended: row.suspended ?? undefined,
    mustChangePassword: row.must_change_password ?? false,
    deletedAt: row.deleted_at ?? undefined,
    scheduledDeletionAt: row.scheduled_deletion_at ?? undefined,
    deletionReason: row.deletion_reason ?? undefined,
    profile: p
      ? {
          id: p.id,
          userId: p.user_id,
          firstName: p.first_name,
          lastName: p.last_name,
          phoneNumber: p.phone_number,
          avatarUrl: p.avatar_url,
          roleId: p.role_id,
          managesAllEvents: p.manages_all_events ?? false,
        }
      : undefined,
    roleName: p?.role?.name as RoleName | undefined,
  }
}

export async function getUsers(params: {
  search?: string
  role?: string
  status?: string
  page?: number
  pageSize?: number
}): Promise<PaginatedResult<UserWithProfile>> {
  let query = supabase
    .from("users")
    .select("id, email, created_at, updated_at, suspended, must_change_password, deleted_at, scheduled_deletion_at, deletion_reason, profile:profiles(*, role:roles(*))", { count: "exact" })

  if (params.search) {
    const q = `%${params.search.toLowerCase()}%`
    query = query.or(`email.ilike.${q},profile.first_name.ilike.${q},profile.last_name.ilike.${q}`)
  }

  if (params.role) {
    const { data: roleRow } = await supabase
      .from("roles")
      .select("id")
      .eq("name", params.role)
      .single()
    if (roleRow) {
      query = query.eq("profile.role_id", roleRow.id)
    }
  }

  if (params.status === "active") {
    query = query.not("suspended", "is", true).is("deleted_at", null)
  } else if (params.status === "suspended") {
    query = query.eq("suspended", true).is("deleted_at", null)
  } else if (params.status === "deleted") {
    query = query.not("deleted_at", "is", null)
  }

  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 10

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, count, error } = await query
    .range(from, to)
    .order("created_at", { ascending: false })

  if (error) throw error

  const items = (data ?? []).map(mapUser)
  const total = count ?? items.length
  const totalPages = Math.ceil(total / pageSize)

  return { items, total, page, pageSize, totalPages }
}

export async function getUserById(id: string): Promise<UserWithProfile | undefined> {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, created_at, updated_at, suspended, must_change_password, deleted_at, scheduled_deletion_at, deletion_reason, profile:profiles(*, role:roles(*))")
    .eq("id", id)
    .single()
  if (error) throw error
  return data ? mapUser(data) : undefined
}

export async function updateUser(id: string, data: { firstName?: string; lastName?: string; phoneNumber?: string; roleId?: string }): Promise<UserWithProfile | undefined> {
  const profilePayload: Record<string, unknown> = {}
  if (data.firstName !== undefined) profilePayload.first_name = data.firstName
  if (data.lastName !== undefined) profilePayload.last_name = data.lastName
  if (data.phoneNumber !== undefined) profilePayload.phone_number = data.phoneNumber
  if (data.roleId !== undefined) profilePayload.role_id = data.roleId

  if (Object.keys(profilePayload).length > 0) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update(profilePayload)
      .eq("user_id", id)
    if (profileError) throw profileError
  }

  await supabase
    .from("users")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id)

  return getUserById(id)
}

export async function suspendUser(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("users")
    .update({ suspended: true, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
  return true
}

export async function activateUser(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("users")
    .update({ suspended: false, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
  return true
}

async function hashPassword(password: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest("SHA-256", data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  }
  return sha256(password)
}

export async function createUser(data: {
  email: string
  password: string
  firstName: string
  lastName: string
  roleName: RoleName
  phoneNumber?: string
}): Promise<UserWithProfile> {
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", data.email)
    .maybeSingle()
  if (existing) throw new Error("Email already in use")

  const passwordHash = await hashPassword(data.password)

  const { data: roleRow } = await supabase
    .from("roles")
    .select("id")
    .eq("name", data.roleName)
    .single()
  if (!roleRow) throw new Error("Role not found")

  const { error: userError } = await supabase
    .from("users")
    .insert({ email: data.email, password_hash: passwordHash })
  if (userError) throw userError

  const { data: user } = await supabase
    .from("users")
    .select("id, email, created_at, updated_at, suspended")
    .eq("email", data.email)
    .single()
  if (!user) throw new Error("User not found")

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      user_id: user.id,
      first_name: data.firstName,
      last_name: data.lastName,
      phone_number: data.phoneNumber ?? "",
      avatar_url: "",
      role_id: roleRow.id,
    })
    .select()
    .single()
  if (profileError) throw profileError

  return {
    id: user.id,
    email: user.email,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    suspended: user.suspended ?? undefined,
    profile: {
      id: profile.id,
      userId: profile.user_id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      phoneNumber: profile.phone_number,
      avatarUrl: profile.avatar_url,
      roleId: profile.role_id,
    },
    roleName: data.roleName,
  }
}

export async function getRoles() {
  const { data, error } = await supabase.from("roles").select("*").order("name")
  if (error) throw error
  return data.map((r: any) => ({ id: r.id, name: r.name, description: r.description }))
}

export async function getProfilesByIds(ids: string[]) {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from("profiles")
    .select("*, user:users(email)")
    .in("id", ids)
  if (error) throw error
  return (data ?? []).map((p: any) => ({
    id: p.id,
    userId: p.user_id,
    firstName: p.first_name,
    lastName: p.last_name,
    phoneNumber: p.phone_number,
    avatarUrl: p.avatar_url,
    roleId: p.role_id,
    email: p.user?.email ?? "",
  }))
}

export async function getProfilesByUserIds(ids: string[]) {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from("profiles")
    .select("*, user:users(email)")
    .in("user_id", ids)
  if (error) throw error
  return (data ?? []).map((p: any) => ({
    id: p.id,
    userId: p.user_id,
    firstName: p.first_name,
    lastName: p.last_name,
    phoneNumber: p.phone_number,
    avatarUrl: p.avatar_url,
    roleId: p.role_id,
    email: p.user?.email ?? "",
  }))
}

export async function getUsersByIds(ids: string[]) {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from("users").select("id, email, created_at, updated_at, suspended").in("id", ids)
  if (error) throw error
  return (data ?? []).map((u: any) => ({
    id: u.id,
    email: u.email,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
    suspended: u.suspended ?? undefined,
  }))
}

export async function getUserByEmail(email: string): Promise<UserWithProfile | undefined> {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, created_at, updated_at, suspended, must_change_password, deleted_at, scheduled_deletion_at, deletion_reason, profile:profiles(*, role:roles(*))")
    .eq("email", email)
    .maybeSingle()
  if (error) throw error
  return data ? mapUser(data) : undefined
}

export async function getAttendeeProfiles(): Promise<{ id: string; userId: string; firstName: string; lastName: string; email: string }[]> {
  const { data: roles } = await supabase.from("roles").select("id, name").eq("name", "attendee")
  if (!roles || roles.length === 0) return []
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, first_name, last_name, user:users(email)")
    .eq("role_id", roles[0].id)
    .order("first_name")
  if (error) throw error
  return (data ?? []).map((p: any) => ({
    id: p.id,
    userId: p.user_id,
    firstName: p.first_name,
    lastName: p.last_name,
    email: p.user?.email ?? "",
  }))
}

export interface AdminUserRef {
  userId: string
  profileId: string
  email: string
  name: string
}

/** All administrators, used for approvals, broadcast and audit notifications. */
export async function getAdminUserIds(): Promise<AdminUserRef[]> {
  const { data: roles } = await supabase.from("roles").select("id").eq("name", "admin")
  if (!roles || roles.length === 0) return []
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, first_name, last_name, user:users(email)")
    .eq("role_id", roles[0].id)
  if (error) throw error
  return (data ?? []).map((p: any) => ({
    userId: p.user_id,
    profileId: p.id,
    email: p.user?.email ?? "",
    name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Admin",
  }))
}

export interface InviteUser {
  id: string
  email: string
  firstName: string
  lastName: string
  roleName: string
}

export async function getAllUsersForInvite(): Promise<InviteUser[]> {
  const { data: roles } = await supabase.from("roles").select("id").eq("name", "attendee")
  if (!roles || roles.length === 0) return []

  const { data, error } = await supabase
    .from("users")
    .select("id, email, profile:profiles(first_name, last_name, role:roles(name))")
    .eq("profile.role_id", roles[0].id)
    .order("email")
  if (error) throw error
  return (data ?? []).map((u: any) => ({
    id: u.id,
    email: u.email,
    firstName: u.profile?.first_name ?? "",
    lastName: u.profile?.last_name ?? "",
    roleName: u.profile?.role?.name ?? "attendee",
  }))
}

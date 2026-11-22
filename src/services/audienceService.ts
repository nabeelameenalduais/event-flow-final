import { supabase } from "../lib/supabase"
import { isMissingRelation } from "../lib/supabaseErrors"
import type { AudienceAccess, AudienceAccessGrant, AudienceContact, RoleName } from "../types"

function mapContact(row: Record<string, any>): AudienceContact {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? "",
    phone: row.phone ?? "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    source: row.source ?? "manual",
    status: row.status ?? "subscribed",
    userId: row.user_id ?? undefined,
    notes: row.notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapGrant(row: Record<string, any>): AudienceAccessGrant {
  return {
    id: row.id,
    userId: row.user_id,
    canView: row.can_view ?? true,
    canEdit: row.can_edit ?? false,
    canSend: row.can_send ?? false,
    startsAt: row.starts_at,
    expiresAt: row.expires_at ?? undefined,
    grantedBy: row.granted_by ?? undefined,
    createdAt: row.created_at,
  }
}

export interface ContactInput {
  email: string
  name?: string
  phone?: string
  tags?: string[]
  source?: string
  notes?: string
  userId?: string
}

export async function getContacts(search?: string): Promise<AudienceContact[]> {
  let query = supabase.from("audience_contacts").select("*").order("created_at", { ascending: false })
  if (search?.trim()) {
    const q = `%${search.trim().toLowerCase()}%`
    query = query.or(`email.ilike.${q},name.ilike.${q},phone.ilike.${q}`)
  }
  const { data, error } = await query
  if (error && isMissingRelation(error)) return []
  if (error) throw error
  return (data ?? []).map(mapContact)
}

export async function getContactByEmail(email: string): Promise<AudienceContact | undefined> {
  const { data, error } = await supabase
    .from("audience_contacts")
    .select("*")
    .ilike("email", email.trim())
    .maybeSingle()
  if (error && isMissingRelation(error)) return undefined
  if (error) throw error
  return data ? mapContact(data) : undefined
}

export async function addContact(input: ContactInput): Promise<AudienceContact> {
  const email = input.email.trim().toLowerCase()
  if (!email) throw new Error("Email is required")
  const existing = await getContactByEmail(email)
  if (existing) {
    const { data, error } = await supabase
      .from("audience_contacts")
      .update({
        name: input.name ?? existing.name,
        phone: input.phone ?? existing.phone,
        tags: input.tags ?? existing.tags,
        notes: input.notes ?? existing.notes,
        status: "subscribed",
        user_id: input.userId ?? existing.userId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single()
    if (error) throw error
    return mapContact(data)
  }
  const { data, error } = await supabase
    .from("audience_contacts")
    .insert({
      email,
      name: input.name ?? "",
      phone: input.phone ?? "",
      tags: input.tags ?? [],
      source: input.source ?? "manual",
      notes: input.notes ?? "",
      user_id: input.userId ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return mapContact(data)
}

export async function updateContact(
  id: string,
  patch: { name?: string; phone?: string; tags?: string[]; notes?: string; status?: AudienceContact["status"] },
): Promise<AudienceContact> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) payload.name = patch.name
  if (patch.phone !== undefined) payload.phone = patch.phone
  if (patch.tags !== undefined) payload.tags = patch.tags
  if (patch.notes !== undefined) payload.notes = patch.notes
  if (patch.status !== undefined) payload.status = patch.status
  const { data, error } = await supabase.from("audience_contacts").update(payload).eq("id", id).select().single()
  if (error) throw error
  return mapContact(data)
}

/** Unsubscribing never deletes the record — sending simply stops. */
export async function unsubscribeContact(id: string): Promise<void> {
  await updateContact(id, { status: "unsubscribed" })
}

export async function unsubscribeByEmail(email: string): Promise<boolean> {
  const contact = await getContactByEmail(email)
  if (!contact) return false
  await updateContact(contact.id, { status: "unsubscribed" })
  return true
}

export async function resubscribeContact(id: string): Promise<void> {
  await updateContact(id, { status: "subscribed" })
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.from("audience_contacts").delete().eq("id", id)
  if (error) throw error
}

/**
 * Adds/updates the audience record for a new registrant so the CRM always
 * contains everyone who has registered at least once.
 */
export async function syncRegistrantToAudience(profileId: string): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, user_id, first_name, last_name, phone_number, user:users(email)")
      .eq("id", profileId)
      .maybeSingle()
    const email = (profile as any)?.user?.email as string | undefined
    if (!profile || !email) return
    const name = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()
    const existing = await getContactByEmail(email)
    if (existing) {
      await supabase
        .from("audience_contacts")
        .update({
          user_id: profile.user_id,
          name: existing.name || name,
          phone: existing.phone || profile.phone_number || "",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
      return
    }
    await supabase.from("audience_contacts").insert({
      email: email.toLowerCase(),
      name,
      phone: profile.phone_number ?? "",
      source: "registration",
      user_id: profile.user_id,
    })
  } catch {
    // Audience sync is best-effort; it must never block registration.
  }
}

/** Flags the address after an account deletion. The record is retained. */
export async function markDeletedAccount(email: string, deletedByEmail: string): Promise<void> {
  try {
    const contact = await getContactByEmail(email)
    if (!contact) return
    const note = `Account deleted on ${new Date().toISOString()} by ${deletedByEmail || "the account owner"}.`
    await supabase
      .from("audience_contacts")
      .update({
        status: "deleted_account",
        notes: contact.notes ? `${contact.notes}\n${note}` : note,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contact.id)
  } catch {
    // best-effort
  }
}

export async function getAccessGrants(): Promise<AudienceAccessGrant[]> {
  const { data, error } = await supabase
    .from("audience_access_grants")
    .select("*")
    .order("created_at", { ascending: false })
  if (error && isMissingRelation(error)) return []
  if (error) throw error
  return (data ?? []).map(mapGrant)
}

export async function grantAudienceAccess(input: {
  userId: string
  canView: boolean
  canEdit: boolean
  canSend: boolean
  expiresAt?: string
  grantedBy: string
}): Promise<AudienceAccessGrant> {
  const { data, error } = await supabase
    .from("audience_access_grants")
    .insert({
      user_id: input.userId,
      can_view: input.canView,
      can_edit: input.canEdit,
      can_send: input.canSend,
      expires_at: input.expiresAt || null,
      granted_by: input.grantedBy,
    })
    .select()
    .single()
  if (error) throw error
  return mapGrant(data)
}

export async function revokeAudienceAccess(id: string): Promise<void> {
  const { error } = await supabase.from("audience_access_grants").delete().eq("id", id)
  if (error) throw error
}

/**
 * Returns the effective audience permissions for a user. Admins always have
 * full access; everyone else is limited by the newest non-expired grant.
 */
export async function getAudienceAccess(userId: string, role: RoleName | null): Promise<AudienceAccess> {
  if (role === "admin") {
    return { canView: true, canEdit: true, canSend: true, isAdmin: true }
  }
  const { data, error } = await supabase
    .from("audience_access_grants")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (error && isMissingRelation(error)) return { canView: false, canEdit: false, canSend: false, isAdmin: false }
  if (error) throw error
  const now = Date.now()
  const active = (data ?? [])
    .map(mapGrant)
    .find((g) => new Date(g.startsAt).getTime() <= now && (!g.expiresAt || new Date(g.expiresAt).getTime() > now))
  if (!active) return { canView: false, canEdit: false, canSend: false, isAdmin: false }
  return {
    canView: active.canView,
    canEdit: active.canEdit,
    canSend: active.canSend,
    isAdmin: false,
    grant: active,
  }
}

export function allAudienceTags(contacts: AudienceContact[]): string[] {
  return [...new Set(contacts.flatMap((c) => c.tags))].sort()
}

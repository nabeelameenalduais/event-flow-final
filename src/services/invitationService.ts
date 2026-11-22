import { supabase } from "../lib/supabase"
import type { InvitationLink } from "../types"

function mapLink(l: Record<string, any>): InvitationLink {
  return {
    id: l.id,
    eventId: l.event_id,
    email: l.email,
    code: l.code,
    used: l.used,
    usedAt: l.used_at ?? null,
    createdAt: l.created_at,
  }
}

export async function getLinksByEvent(eventId: string): Promise<InvitationLink[]> {
  const { data, error } = await supabase
    .from("invitation_links")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at")
  if (error) throw error
  return (data ?? []).map(mapLink)
}

export async function createLink(eventId: string, email: string): Promise<InvitationLink> {
  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 12)
  const { data, error } = await supabase
    .from("invitation_links")
    .insert({ event_id: eventId, email, code })
    .select()
    .single()
  if (error) throw error
  return mapLink(data)
}

export async function createLinksBulk(eventId: string, emails: string[]): Promise<InvitationLink[]> {
  const uniqueEmails = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))]
  if (uniqueEmails.length === 0) return []

  // Avoid duplicates with existing links for the same event
  const { data: existing } = await supabase
    .from("invitation_links")
    .select("email")
    .eq("event_id", eventId)
  const existingEmails = new Set((existing ?? []).map((l) => l.email.toLowerCase()))

  const toInsert = uniqueEmails.filter((e) => !existingEmails.has(e))
  if (toInsert.length === 0) return []

  const rows = toInsert.map((email) => ({
    event_id: eventId,
    email,
    code: crypto.randomUUID().replace(/-/g, "").slice(0, 12),
  }))

  const { data, error } = await supabase
    .from("invitation_links")
    .insert(rows)
    .select()
  if (error) throw error
  return (data ?? []).map(mapLink)
}

export async function deleteLink(id: string): Promise<boolean> {
  const { error } = await supabase.from("invitation_links").delete().eq("id", id)
  if (error) throw error
  return true
}

export async function getLinkByCode(code: string): Promise<InvitationLink | undefined> {
  const { data, error } = await supabase
    .from("invitation_links")
    .select("*")
    .eq("code", code)
    .maybeSingle()
  if (error) throw error
  return data ? mapLink(data) : undefined
}

export async function markLinkAsUsed(id: string): Promise<void> {
  const { error } = await supabase
    .from("invitation_links")
    .update({ used: true, used_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}

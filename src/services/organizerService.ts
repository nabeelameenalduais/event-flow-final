import { supabase } from "../lib/supabase"

export interface OrganizerInfo {
  userId: string
  email: string
  firstName: string
  lastName: string
  isPrimary: boolean
  managesAllEvents: boolean
}

export async function getEventOrganizers(eventId: string): Promise<OrganizerInfo[]> {
  const { data, error } = await supabase
    .from("event_organizers")
    .select("*, user:users(email)")
    .eq("event_id", eventId)
    .order("is_primary", { ascending: false })
  if (error) throw error

  const rows = (data ?? []).filter((r: any) => r.user)
  const userIds = rows.map((r: any) => r.user_id)
  const profileMap: Record<string, any> = {}

  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, manages_all_events")
      .in("user_id", userIds)
    for (const p of profs ?? []) profileMap[p.user_id] = p
  }

  return rows.map((r: any) => ({
    userId: r.user_id,
    email: r.user?.email ?? "",
    firstName: profileMap[r.user_id]?.first_name ?? "",
    lastName: profileMap[r.user_id]?.last_name ?? "",
    isPrimary: r.is_primary,
    managesAllEvents: profileMap[r.user_id]?.manages_all_events ?? false,
  }))
}

export async function getEventOrganizerIds(eventId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("event_organizers")
    .select("user_id")
    .eq("event_id", eventId)
  if (error) throw error
  return (data ?? []).map((r: any) => r.user_id)
}

export async function assignOrganizer(eventId: string, userId: string, actorId: string): Promise<boolean> {
  const { error } = await supabase
    .from("event_organizers")
    .insert({ event_id: eventId, user_id: userId, is_primary: false, created_by: actorId })
  if (error) throw error
  return true
}

export async function assignOrganizers(eventId: string, userIds: string[], actorId: string): Promise<boolean> {
  if (userIds.length === 0) return true
  const rows = userIds.map((userId) => ({ event_id: eventId, user_id: userId, is_primary: false, created_by: actorId }))
  const { error } = await supabase.from("event_organizers").insert(rows)
  if (error) throw error
  return true
}

export async function removeOrganizer(eventId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("event_organizers")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId)
  if (error) throw error
  return true
}

export async function setOrganizerAllEvents(userId: string, manages: boolean): Promise<boolean> {
  const { error } = await supabase
    .from("profiles")
    .update({ manages_all_events: manages })
    .eq("user_id", userId)
  if (error) throw error
  return true
}

export async function getAllOrganizers(): Promise<OrganizerInfo[]> {
  const { data: roles } = await supabase
    .from("roles")
    .select("id, name")
    .in("name", ["organizer", "admin"])
  if (!roles || roles.length === 0) return []

  const { data: profs, error } = await supabase
    .from("profiles")
    .select("user_id, first_name, last_name, role_id, manages_all_events, user:users(email)")
    .in("role_id", roles.map((r) => r.id))
    .order("first_name")
  if (error) throw error

  return (profs ?? []).map((p: any) => ({
    userId: p.user_id,
    email: p.user?.email ?? "",
    firstName: p.first_name,
    lastName: p.last_name,
    isPrimary: false,
    managesAllEvents: p.manages_all_events ?? false,
  }))
}

export async function isOrganizerOfEvent(eventId: string, userId: string): Promise<boolean> {
  const { data: event } = await supabase
    .from("events")
    .select("organizer_id")
    .eq("id", eventId)
    .single()

  if (event?.organizer_id) {
    // events.organizer_id references profiles.id, while callers pass users.id.
    if (event.organizer_id === userId) return true
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()
    if (profile?.id && event.organizer_id === profile.id) return true
  }

  const { data } = await supabase
    .from("event_organizers")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle()
  return !!data
}

export async function getAllEventsOrganizerIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("manages_all_events", true)
  if (error) throw error
  return (data ?? []).map((p: any) => p.user_id)
}

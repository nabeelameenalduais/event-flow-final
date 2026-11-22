import { supabase } from "../lib/supabase"
import { getSessionToken } from "../lib/session"
import { isMissingFunction, isMissingRelation } from "../lib/supabaseErrors"
import type { Event, MeetingChatMessage, MeetingPresence } from "../types"

const JITSI_HOSTS = ["meet.jit.si", "jit.si", "8x8.vc", "jitsi"]

export function isJitsiLink(link?: string | null): boolean {
  if (!link) return false
  try {
    const host = new URL(link).hostname.toLowerCase()
    return JITSI_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

export function isEmbeddableMeeting(event: Pick<Event, "meetingLink" | "meetingProvider">): boolean {
  if (!event.meetingLink) return false
  if (event.meetingProvider && event.meetingProvider !== "jitsi") return false
  return isJitsiLink(event.meetingLink)
}

function slugify(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .toLowerCase()
}

export function getJitsiRoomName(
  event: Pick<Event, "meetingRoomName" | "meetingLink" | "title" | "id">,
): string {
  if (event.meetingRoomName?.trim()) return event.meetingRoomName.trim()
  if (event.meetingLink) {
    try {
      const url = new URL(event.meetingLink)
      const room = url.pathname.replace(/^\/+/, "").split("/")[0]
      if (room) return room
    } catch {
      // fall through to generated room name
    }
  }
  const slug = slugify(event.title || "event")
  return `EventFlow-${slug || "room"}-${event.id.slice(0, 8)}`
}

export function buildJitsiEmbedUrl(room: string, displayName?: string, sourceLink?: string): string {
  let origin = "https://meet.jit.si"
  if (sourceLink) {
    try {
      const url = new URL(sourceLink)
      if (isJitsiLink(sourceLink)) origin = url.origin
    } catch {
      // keep default origin
    }
  }
  const name = displayName?.trim()
  const hash = [
    "config.prejoinPageEnabled=false",
    "config.startWithAudioMuted=true",
    "config.startWithVideoMuted=false",
    "config.disableDeepLinking=true",
    "config.disableThirdPartyRequests=true",
    "interfaceConfig.SHOW_JITSI_WATERMARK=false",
    "interfaceConfig.SHOW_BRAND_WATERMARK=false",
    name ? `userInfo.displayName=${encodeURIComponent(JSON.stringify(name))}` : "",
  ]
    .filter(Boolean)
    .join("&")
  return `${origin}/${encodeURIComponent(room)}#${hash}`
}

export function buildJitsiExternalUrl(room: string, sourceLink?: string): string {
  if (sourceLink && isJitsiLink(sourceLink)) {
    try {
      const url = new URL(sourceLink)
      return `${url.origin}/${encodeURIComponent(room)}`
    } catch {
      // fall through
    }
  }
  return `https://meet.jit.si/${encodeURIComponent(room)}`
}

function mapPresence(row: Record<string, any>): MeetingPresence {
  return {
    id: row.id,
    eventId: row.event_id,
    attendeeId: row.attendee_id,
    userId: row.user_id ?? undefined,
    firstJoinedAt: row.first_joined_at,
    lastSeenAt: row.last_seen_at,
    totalSeconds: Number(row.total_seconds ?? 0),
    isVisible: row.is_visible ?? true,
    attended: row.attended ?? false,
  }
}

function mapMessage(row: Record<string, any>): MeetingChatMessage {
  return {
    id: row.id,
    eventId: row.event_id,
    senderId: row.sender_id,
    content: row.content,
    createdAt: row.created_at,
  }
}

export interface PresenceResult {
  totalSeconds: number
  attended: boolean
}

interface PresenceTotals {
  total: number
  attended: boolean
  unavailable?: boolean
}

/**
 * Records visible meeting time for an attendee. The database function
 * accumulates presence atomically, checks the configured dwell time and
 * records attendance exactly once. The client fallback (only used when that
 * function is not deployed) uses optimistic concurrency instead of a blind
 * read-modify-write, and never swallows database errors.
 */
export async function recordMeetingPresence(
  eventId: string,
  attendeeId: string,
  userId: string,
  seconds: number,
  isVisible: boolean,
): Promise<PresenceResult> {
  const safeSeconds = Math.max(0, Math.min(Math.round(seconds), 3600))
  const { data, error } = await supabase.rpc("record_meeting_presence", {
    p_event_id: eventId,
    p_attendee_id: attendeeId,
    p_user_id: userId,
    p_seconds: safeSeconds,
    p_session_token: getSessionToken(),
    p_visible: isVisible,
  })

  if (error) {
    if (isMissingFunction(error) || isMissingRelation(error)) {
      return recordPresenceFallback(eventId, attendeeId, userId, safeSeconds, isVisible)
    }
    throw error
  }
  if (!data) throw new Error("Meeting presence update returned no result")

  const result = data as { error?: string; total_seconds?: number; attended?: boolean }
  if (result.error) throw new Error(result.error)
  return { totalSeconds: Number(result.total_seconds ?? 0), attended: Boolean(result.attended) }
}

/** Optimistically increment presence, retrying if another tick won the race. */
async function bumpPresence(
  eventId: string,
  attendeeId: string,
  userId: string,
  seconds: number,
  isVisible: boolean,
): Promise<PresenceTotals> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const now = new Date().toISOString()
    const { data: existing, error } = await supabase
      .from("meeting_presence")
      .select("id, total_seconds, attended")
      .eq("event_id", eventId)
      .eq("attendee_id", attendeeId)
      .maybeSingle()
    if (error) {
      if (isMissingRelation(error)) return { total: seconds, attended: false, unavailable: true }
      throw error
    }

    if (existing) {
      const previous = Number(existing.total_seconds ?? 0)
      const total = previous + seconds
      const { data: updated, error: updateError } = await supabase
        .from("meeting_presence")
        .update({ total_seconds: total, is_visible: isVisible, last_seen_at: now, user_id: userId })
        .eq("id", existing.id)
        .eq("total_seconds", previous)
        .select("total_seconds, attended")
        .maybeSingle()
      if (updateError) {
        if (isMissingRelation(updateError)) return { total, attended: false, unavailable: true }
        throw updateError
      }
      // Someone else updated the row first — reload and add this tick again.
      if (!updated) continue
      return { total, attended: Boolean(updated.attended) }
    }

    const { error: insertError } = await supabase.from("meeting_presence").insert({
      event_id: eventId,
      attendee_id: attendeeId,
      user_id: userId,
      total_seconds: seconds,
      is_visible: isVisible,
      last_seen_at: now,
    })
    if (insertError) {
      if (isMissingRelation(insertError)) return { total: seconds, attended: false, unavailable: true }
      // Another tick inserted the row between our read and insert.
      if (insertError.code === "23505") continue
      throw insertError
    }
    return { total: seconds, attended: false }
  }

  throw new Error("Could not record meeting presence after repeated concurrent updates")
}

async function recordPresenceFallback(
  eventId: string,
  attendeeId: string,
  userId: string,
  seconds: number,
  isVisible: boolean,
): Promise<PresenceResult> {
  const { total, attended, unavailable } = await bumpPresence(eventId, attendeeId, userId, seconds, isVisible)
  if (unavailable) return { totalSeconds: total, attended: false }
  if (attended) return { totalSeconds: total, attended: true }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("meeting_attendance_minutes")
    .eq("id", eventId)
    .maybeSingle()
  if (eventError) {
    if (isMissingRelation(eventError)) return { totalSeconds: total, attended: false }
    throw eventError
  }
  const minutes = Number(event?.meeting_attendance_minutes ?? 10)
  if (minutes <= 0 || total < minutes * 60) return { totalSeconds: total, attended: false }

  const { data: reg, error: regError } = await supabase
    .from("registrations")
    .select("id")
    .eq("event_id", eventId)
    .eq("attendee_id", attendeeId)
    .eq("status", "confirmed")
    .maybeSingle()
  if (regError) {
    if (isMissingRelation(regError)) return { totalSeconds: total, attended: false }
    throw regError
  }
  if (!reg) return { totalSeconds: total, attended: false }

  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .select("id")
    .eq("registration_id", reg.id)
    .maybeSingle()
  if (ticketError) {
    if (isMissingRelation(ticketError)) return { totalSeconds: total, attended: false }
    throw ticketError
  }
  if (!ticket) return { totalSeconds: total, attended: false }

  // The unique (ticket_id) constraint makes this idempotent even when two
  // presence ticks cross the threshold at the same moment.
  const attendanceRow = {
    ticket_id: ticket.id,
    // Auto-attendance is only ever produced by joining the online meeting, so
    // it always records the online mode, matching record_meeting_presence().
    mode: "online",
    source: "auto_presence",
    presence_seconds: total,
  }
  const { error: attendanceError } = await supabase
    .from("attendance")
    .upsert(attendanceRow, { onConflict: "ticket_id", ignoreDuplicates: true })
  if (attendanceError) {
    if (isMissingRelation(attendanceError)) return { totalSeconds: total, attended: false }
    // Older schemas may not have the optional columns yet.
    if (/mode|source|presence_seconds/i.test(attendanceError.message ?? "")) {
      const { error: minimalError } = await supabase
        .from("attendance")
        .upsert({ ticket_id: ticket.id }, { onConflict: "ticket_id", ignoreDuplicates: true })
      if (minimalError) throw minimalError
    } else {
      throw attendanceError
    }
  }

  const { error: ticketUpdateError } = await supabase
    .from("tickets")
    .update({ status: "used" })
    .eq("id", ticket.id)
  if (ticketUpdateError) throw ticketUpdateError

  const { error: presenceUpdateError } = await supabase
    .from("meeting_presence")
    .update({ attended: true })
    .eq("event_id", eventId)
    .eq("attendee_id", attendeeId)
  if (presenceUpdateError) throw presenceUpdateError

  return { totalSeconds: total, attended: true }
}

export async function getPresenceForEvent(eventId: string): Promise<MeetingPresence[]> {
  const { data, error } = await supabase
    .from("meeting_presence")
    .select("*")
    .eq("event_id", eventId)
    .order("total_seconds", { ascending: false })
  if (error && isMissingRelation(error)) return []
  if (error) throw error
  return (data ?? []).map(mapPresence)
}

export async function getMyPresence(eventId: string, attendeeId: string): Promise<MeetingPresence | undefined> {
  const { data, error } = await supabase
    .from("meeting_presence")
    .select("*")
    .eq("event_id", eventId)
    .eq("attendee_id", attendeeId)
    .maybeSingle()
  if (error && isMissingRelation(error)) return undefined
  if (error) throw error
  return data ? mapPresence(data) : undefined
}

async function attachSenderNames(messages: MeetingChatMessage[]): Promise<MeetingChatMessage[]> {
  const ids = [...new Set(messages.map((m) => m.senderId))]
  if (ids.length === 0) return messages
  const { data } = await supabase
    .from("profiles")
    .select("user_id, first_name, last_name")
    .in("user_id", ids)
  const map = new Map<string, string>()
  for (const p of data ?? []) {
    const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()
    if (p.user_id) map.set(p.user_id, name || "User")
  }
  return messages.map((m) => ({ ...m, senderName: map.get(m.senderId) ?? "User" }))
}

export async function getMeetingMessages(eventId: string): Promise<MeetingChatMessage[]> {
  const { data, error } = await supabase
    .from("meeting_chat_messages")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true })
  if (error && isMissingRelation(error)) return []
  if (error) throw error
  return attachSenderNames((data ?? []).map(mapMessage))
}

export async function sendMeetingMessage(eventId: string, senderId: string, content: string): Promise<MeetingChatMessage> {
  const trimmed = content.trim()
  if (!trimmed) throw new Error("Message cannot be empty")
  const { data, error } = await supabase
    .from("meeting_chat_messages")
    .insert({ event_id: eventId, sender_id: senderId, content: trimmed })
    .select("*")
    .single()
  if (error) throw error
  return mapMessage(data)
}

export function subscribeToMeetingChat(eventId: string, onInsert: () => void): () => void {
  const channel = supabase
    .channel(`meeting-chat-${eventId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "meeting_chat_messages", filter: `event_id=eq.${eventId}` },
      () => onInsert(),
    )
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}

export interface MeetingStats {
  visible: number
  total: number
  attended: number
  totalSeconds: number
}

export function summarizePresence(rows: MeetingPresence[]): MeetingStats {
  return {
    total: rows.length,
    visible: rows.filter((r) => r.isVisible).length,
    attended: rows.filter((r) => r.attended).length,
    totalSeconds: rows.reduce((sum, r) => sum + r.totalSeconds, 0),
  }
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

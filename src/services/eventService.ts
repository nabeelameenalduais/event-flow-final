import { runtimeFormatDate as formatDate, runtimeT as t } from "../i18n/runtimeLocale"
import { supabase } from "../lib/supabase"
import type { AttendanceMode, Event, Session, Speaker, Registration, Feedback, Ticket } from "../types"
import { checkBanForRegistration, describeBan } from "./banService"
import { generateTicket } from "./ticketService"
import { assertValidEventDates } from "../utils/eventDates"
import { getLinkByCode, markLinkAsUsed } from "./invitationService"
import { sendNotification } from "./notificationService"
import { syncRegistrantToAudience } from "./audienceService"
import { sendEmail, textToHtml } from "./emailService"

export async function getEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("status", "published")
    .eq("visibility", "public")
    .is("deleted_at", null)
    .order("start_date")
  if (error) throw error
  return data.map(mapEvent)
}

export async function getAllEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
  if (error) throw error
  return data.map(mapEvent)
}

export async function getEventById(id: string): Promise<Event | undefined> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (error) throw error
  return data ? mapEvent(data) : undefined
}

export async function getEventsByOrganizer(organizerId: string): Promise<Event[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("organizer_id", organizerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
  if (error) throw error
  return data.map(mapEvent)
}

/**
 * All events a user can manage: their own, events they are assigned to
 * (event_organizers), plus every event when role is admin or managesAllEvents.
 */
export async function getEventsForUser(
  profileId: string,
  userId: string,
  role: string,
  managesAllEvents: boolean,
): Promise<Event[]> {
  if (role === "admin" || managesAllEvents) return getAllEvents()

  const own = await getEventsByOrganizer(profileId)

  const { data: assigned } = await supabase
    .from("event_organizers")
    .select("event_id")
    .eq("user_id", userId)
  const eventIds = (assigned ?? []).map((r: any) => r.event_id)

  let fromAssignments: Event[] = []
  if (eventIds.length > 0) {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .in("id", eventIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
    if (error) throw error
    fromAssignments = data.map(mapEvent)
  }

  const seen = new Set<string>()
  return [...own, ...fromAssignments].filter((e) => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })
}

export async function createEvent(data: Omit<Event, "id">): Promise<Event> {
  assertValidEventDates(data)
  const { data: inserted, error } = await supabase
    .from("events")
    .insert(toDbEvent(data))
    .select()
    .single()
  if (error) throw error
  return mapEvent(inserted)
}

export async function updateEvent(id: string, data: Partial<Event>): Promise<Event | undefined> {
  const payload: Record<string, unknown> = {}
  if (data.title !== undefined) payload.title = data.title
  if (data.description !== undefined) payload.description = data.description
  if (data.coverImageUrl !== undefined) payload.cover_image_url = data.coverImageUrl
  if (data.organizerId !== undefined) payload.organizer_id = data.organizerId
  if (data.venueId !== undefined) payload.venue_id = data.venueId || null
  if (data.capacity !== undefined) payload.capacity = data.capacity
  if (data.registrationDeadline !== undefined) payload.registration_deadline = data.registrationDeadline
  if (data.startDate !== undefined) payload.start_date = data.startDate
  if (data.endDate !== undefined) payload.end_date = data.endDate
  if (data.status !== undefined) payload.status = data.status
  if (data.visibility !== undefined) payload.visibility = data.visibility
  if (data.contactEmail !== undefined) payload.contact_email = data.contactEmail
  if (data.categoryId !== undefined) payload.category_id = data.categoryId
  if (data.eventType !== undefined) payload.event_type = data.eventType
  if (data.meetingLink !== undefined) payload.meeting_link = data.meetingLink
  if (data.onlineCapacity !== undefined) payload.online_capacity = data.onlineCapacity
  if (data.inPersonCapacity !== undefined) payload.in_person_capacity = data.inPersonCapacity
  if (data.meetingProvider !== undefined) payload.meeting_provider = data.meetingProvider
  if (data.meetingAttendanceMinutes !== undefined) payload.meeting_attendance_minutes = data.meetingAttendanceMinutes
  if (data.meetingRoomName !== undefined) payload.meeting_room_name = data.meetingRoomName
  if (data.hybridNote !== undefined) payload.hybrid_note = data.hybridNote

  // A partial update can still produce an invalid range, so validate the
  // merged values before writing. Status-only updates skip the extra read.
  if (data.registrationDeadline !== undefined || data.startDate !== undefined || data.endDate !== undefined) {
    const { data: current, error: fetchError } = await supabase
      .from("events")
      .select("registration_deadline, start_date, end_date")
      .eq("id", id)
      .maybeSingle()
    if (fetchError) throw fetchError
    if (!current) throw new Error("Event not found")
    assertValidEventDates({
      registrationDeadline: data.registrationDeadline ?? current.registration_deadline,
      startDate: data.startDate ?? current.start_date,
      endDate: data.endDate ?? current.end_date,
    })
  }

  const { data: updated, error } = await supabase
    .from("events")
    .update(payload)
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return updated ? mapEvent(updated) : undefined
}

export async function setMeetingLink(
  id: string,
  link: string,
  generatedBy: string,
): Promise<Event | undefined> {
  const { data: updated, error } = await supabase
    .from("events")
    .update({
      meeting_link: link,
      meeting_link_generated_by: generatedBy,
      meeting_link_created_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return updated ? mapEvent(updated) : undefined
}

export function isMeetingLinkVisible(event: Pick<Event, "eventType" | "meetingLink" | "startDate" | "meetingLinkCreatedAt">): boolean {
  if (event.eventType === "in_person" || !event.meetingLink) return false
  const oneHourBefore = new Date(event.startDate).getTime() - 60 * 60 * 1000
  return Date.now() >= oneHourBefore
}

export async function deleteEvent(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
  return true
}

export async function restoreEvent(id: string): Promise<Event | undefined> {
  const { data, error } = await supabase
    .from("events")
    .update({ deleted_at: null })
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data ? mapEvent(data) : undefined
}

export async function duplicateEvent(id: string): Promise<Event | undefined> {
  const original = await getEventById(id)
  if (!original) return undefined
  return createEvent({
    ...original,
    title: `${original.title} ${t("(Copy)")}`,
    status: "draft",
    visibility: "private",
    meetingLink: undefined,
    meetingLinkGeneratedBy: undefined,
    meetingLinkCreatedAt: undefined,
  })
}

export async function publishEvent(id: string): Promise<Event | undefined> {
  return updateEvent(id, { status: "published" })
}

export async function archiveEvent(id: string): Promise<Event | undefined> {
  return updateEvent(id, { status: "archived" })
}

export async function setDraft(id: string): Promise<Event | undefined> {
  return updateEvent(id, { status: "draft" })
}

export async function getSessions(eventId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("event_id", eventId)
    .order("start_time")
  if (error) throw error
  return data.map(mapSession)
}

export async function getSpeakers(sessionId: string): Promise<Speaker[]> {
  const { data, error } = await supabase
    .from("speakers")
    .select("*")
    .eq("session_id", sessionId)
  if (error) throw error
  return data.map(mapSpeaker)
}

export async function getRegistrations(eventId: string): Promise<Registration[]> {
  const { data, error } = await supabase
    .from("registrations")
    .select("*")
    .eq("event_id", eventId)
  if (error) throw error
  return data.map(mapRegistration)
}

export async function getRegistrationForAttendee(eventId: string, attendeeId: string): Promise<Registration | undefined> {
  const { data, error } = await supabase
    .from("registrations")
    .select("*")
    .eq("event_id", eventId)
    .eq("attendee_id", attendeeId)
    .neq("status", "cancelled")
    .maybeSingle()
  if (error) throw error
  return data ? mapRegistration(data) : undefined
}

function resolveAttendanceMode(eventType: string | null, requested?: AttendanceMode | null): AttendanceMode {
  if (eventType === "hybrid") {
    if (requested !== "online" && requested !== "in_person") {
      throw new Error("Choose whether you will attend in person or online")
    }
    return requested
  }
  return eventType === "online" ? "online" : "in_person"
}

function capacityForMode(
  event: { capacity: number; event_type?: string | null; online_capacity?: number | null; in_person_capacity?: number | null },
  mode: AttendanceMode,
): number {
  if (event.event_type === "hybrid") {
    return mode === "online"
      ? Number(event.online_capacity ?? event.capacity ?? 0)
      : Number(event.in_person_capacity ?? event.capacity ?? 0)
  }
  return Number(event.capacity ?? 0)
}

async function countConfirmed(eventId: string, mode?: AttendanceMode): Promise<number> {
  let query = supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "confirmed")
  if (mode) query = query.eq("attendance_mode", mode)
  const { count } = await query
  return count ?? 0
}

/** 1-based waiting-list position from the registration timestamp. */
export async function getWaitlistPosition(
  eventId: string,
  registeredAt: string,
  mode?: AttendanceMode,
): Promise<number> {
  let query = supabase
    .from("registrations")
    .select("registered_at")
    .eq("event_id", eventId)
    .eq("status", "waitlisted")
  if (mode) query = query.eq("attendance_mode", mode)
  const { data } = await query.order("registered_at")
  const rows = data ?? []
  const index = rows.findIndex((row: any) => new Date(row.registered_at).getTime() >= new Date(registeredAt).getTime())
  return index === -1 ? rows.length + 1 : index + 1
}

export interface WaitlistInfo {
  position: number
  ahead: number
  waitlistTotal: number
  confirmed: number
  capacity: number
  availableSeats: number
}

export async function getWaitlistInfo(eventId: string, registrationId: string): Promise<WaitlistInfo> {
  const { data: reg } = await supabase
    .from("registrations")
    .select("event_id, status, attendance_mode, registered_at")
    .eq("id", registrationId)
    .maybeSingle()
  const { data: event } = await supabase
    .from("events")
    .select("capacity, event_type, online_capacity, in_person_capacity")
    .eq("id", eventId)
    .maybeSingle()

  const mode = resolveAttendanceMode(event?.event_type ?? null, (reg as any)?.attendance_mode)
  const capacity = event ? capacityForMode(event, mode) : 0
  const confirmed = await countConfirmed(eventId, event?.event_type === "hybrid" ? mode : undefined)

  let waitlistQuery = supabase
    .from("registrations")
    .select("id, registered_at")
    .eq("event_id", eventId)
    .eq("status", "waitlisted")
  if (event?.event_type === "hybrid") waitlistQuery = waitlistQuery.eq("attendance_mode", mode)
  const { data: waitlisted } = await waitlistQuery.order("registered_at")
  const rows = (waitlisted ?? []) as { id: string; registered_at: string }[]
  const index = rows.findIndex((row) => row.id === registrationId)
  const isWaitlisted = (reg as any)?.status === "waitlisted" && index !== -1

  return {
    position: isWaitlisted ? index + 1 : 0,
    ahead: isWaitlisted ? index : 0,
    waitlistTotal: rows.length,
    confirmed,
    capacity,
    availableSeats: Math.max(0, capacity - confirmed),
  }
}

export interface RegistrationCounts {
  confirmed: number
  waitlisted: number
  onlineConfirmed: number
  inPersonConfirmed: number
  capacity: number
  onlineCapacity: number
  inPersonCapacity: number
}

export async function getRegistrationCounts(eventId: string): Promise<RegistrationCounts> {
  const { data: event } = await supabase
    .from("events")
    .select("capacity, event_type, online_capacity, in_person_capacity")
    .eq("id", eventId)
    .maybeSingle()
  const { data } = await supabase
    .from("registrations")
    .select("status, attendance_mode")
    .eq("event_id", eventId)
  const rows = (data ?? []) as { status: string; attendance_mode?: string | null }[]
  const confirmed = rows.filter((r) => r.status === "confirmed")
  return {
    confirmed: confirmed.length,
    waitlisted: rows.filter((r) => r.status === "waitlisted").length,
    onlineConfirmed: confirmed.filter((r) => r.attendance_mode === "online").length,
    inPersonConfirmed: confirmed.filter((r) => r.attendance_mode === "in_person").length,
    capacity: Number(event?.capacity ?? 0),
    onlineCapacity: Number(event?.online_capacity ?? event?.capacity ?? 0),
    inPersonCapacity: Number(event?.in_person_capacity ?? event?.capacity ?? 0),
  }
}

export async function registerForEvent(
  eventId: string,
  attendeeId: string,
  code?: string,
  attendanceMode?: AttendanceMode,
): Promise<{ registration: Registration; waitlisted: boolean; waitlistPosition?: number; waitlistInfo?: WaitlistInfo }> {
  const { data: event } = await supabase
    .from("events")
    .select("title, capacity, visibility, status, start_date, end_date, registration_deadline, event_type, online_capacity, in_person_capacity, category_id")
    .eq("id", eventId)
    .single()
  if (!event) throw new Error("Event not found")

  if (event.status !== "published") {
    throw new Error("This event is not open for registration")
  }
  if (event.registration_deadline && new Date(event.registration_deadline).getTime() < Date.now()) {
    throw new Error("The registration deadline has passed")
  }
  if (new Date(event.end_date).getTime() < Date.now()) {
    throw new Error("This event has already ended")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, user_id, user:users(email)")
    .eq("id", attendeeId)
    .maybeSingle()
  if (!profile) throw new Error("Profile not found")

  if (event.visibility === "private") {
    if (!code) throw new Error("An invitation code is required for this private event")
    const link = await getLinkByCode(code)
    if (!link) throw new Error("Invalid invitation link")
    if (link.used) throw new Error("This invitation link has already been used")
    if (link.eventId !== eventId) throw new Error("This invitation link does not belong to this event")

    const attendeeEmail = (profile as any)?.user?.email
    if (!attendeeEmail || attendeeEmail !== link.email) {
      throw new Error("This invitation was sent to a different email address")
    }
  }

  // Bans only block new registrations; existing registrations are untouched.
  const ban = await checkBanForRegistration(profile.user_id, eventId, event.category_id ?? undefined)
  if (ban) {
    const expiry = ban.isPermanent ? "" : ban.expiresAt ? ` until ${formatDate(ban.expiresAt)}` : ""
    throw new Error(
      `You cannot register for this event because of ${describeBan(ban)}${expiry}.${ban.reason ? ` Reason: ${ban.reason}.` : ""}`,
    )
  }

  const existing = await getRegistrationForAttendee(eventId, attendeeId)
  if (existing) throw new Error("Already registered for this event")

  const mode = resolveAttendanceMode(event.event_type, attendanceMode)
  const capacity = capacityForMode(event, mode)
  const confirmedCount = await countConfirmed(eventId, event.event_type === "hybrid" ? mode : undefined)
  const isFull = capacity > 0 && confirmedCount >= capacity

  const status: "confirmed" | "waitlisted" = isFull ? "waitlisted" : "confirmed"

  const { data: registration, error } = await supabase
    .from("registrations")
    .insert({ event_id: eventId, attendee_id: attendeeId, status, attendance_mode: mode })
    .select()
    .single()
  if (error) throw error

  if (!isFull) {
    await generateTicketForRegistration(mapRegistration(registration), event.title, event.event_type)
  }

  const reg = mapRegistration(registration)

  // Send confirmation / waitlist notification
  const modeLabel = mode === "online" ? "online" : "in person"
  if (!isFull) {
    await sendNotification(
      profile.user_id,
      "registration_confirmation",
      `Your ${modeLabel} registration for "${event.title}" has been confirmed. Your ticket is ready in your dashboard.`,
      `/events/${eventId}`,
    )
  } else {
    const position = await getWaitlistPosition(
      eventId,
      registration.registered_at,
      event.event_type === "hybrid" ? mode : undefined,
    )
    const ahead = Math.max(0, position - 1)
    await sendNotification(
      profile.user_id,
      "waitlist",
      `"${event.title}" is full for ${modeLabel} attendance. You are number ${position} on the waiting list (${ahead} ahead). You will be notified automatically if a seat opens.`,
      `/events/${eventId}`,
    )
  }

  // Keep the audience CRM in sync with everyone who registers.
  await syncRegistrantToAudience(attendeeId)

  if (event.visibility === "private" && code) {
    const { data: link } = await supabase
      .from("invitation_links")
      .select("id")
      .eq("code", code)
      .single()
    if (link) await markLinkAsUsed(link.id)

    // Notify the organizer(s) that the invited user has joined
    const { data: ev } = await supabase
      .from("events")
      .select("organizer_id, title")
      .eq("id", eventId)
      .single()
    const { data: orgProf } = ev
      ? await supabase.from("profiles").select("user_id").eq("id", ev.organizer_id).single()
      : { data: null }
    if (orgProf && ev) {
      await sendNotification(
        orgProf.user_id,
        "invitation_used",
        `An invited guest just registered for "${ev.title}" using their invitation link.`,
        `/events/${eventId}`,
      )
    }
  }

  const waitlistInfo = isFull ? await getWaitlistInfo(eventId, reg.id) : undefined
  return { registration: reg, waitlisted: isFull, waitlistPosition: waitlistInfo?.position, waitlistInfo }
}

async function generateTicketForRegistration(
  registration: Registration,
  eventTitle: string,
  eventType?: string | null,
): Promise<Ticket> {
  const mode = resolveAttendanceMode(eventType ?? null, registration.attendanceMode)
  return generateTicket(registration.id, eventTitle, mode, registration.eventId)
}

/**
 * Promotes the oldest waitlisted registration (per registration order), issues
 * its ticket and notifies the attendee.
 */
async function promoteFirstWaitlisted(eventId: string, attendanceMode?: AttendanceMode): Promise<Registration | null> {
  let query = supabase
    .from("registrations")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "waitlisted")
  if (attendanceMode) query = query.eq("attendance_mode", attendanceMode)
  const { data: waitlisted } = await query.order("registered_at").limit(1)

  if (!waitlisted || waitlisted.length === 0) return null
  const row = waitlisted[0]

  await supabase.from("registrations").update({ status: "confirmed" }).eq("id", row.id)

  const { data: ev } = await supabase
    .from("events")
    .select("title, event_type")
    .eq("id", eventId)
    .single()
  if (ev) {
    await generateTicketForRegistration(mapRegistration(row), ev.title, ev.event_type)
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select("user_id, first_name, last_name, user:users(email)")
    .eq("id", row.attendee_id)
    .maybeSingle()
  if (prof) {
    const modeLabel = (row.attendance_mode ?? (ev?.event_type === "online" ? "online" : "in_person")) === "online" ? "online" : "in person"
    const message = `A seat opened for "${ev?.title ?? "an event"}" (${modeLabel}). You have been moved from the waiting list to confirmed and your ticket is ready.`
    await sendNotification(
      prof.user_id,
      "waitlist_promotion",
      message,
      `/events/${eventId}`,
    )

    // A promotion is an important status change: send an email as well as the
    // in-app notification. In mock mode the email is logged to the console.
    const relatedUser = Array.isArray((prof as any).user) ? (prof as any).user[0] : (prof as any).user
    const email = relatedUser?.email as string | undefined
    if (email) {
      const greeting = `${prof.first_name ?? ""} ${prof.last_name ?? ""}`.trim()
      await sendEmail({
        to: email,
        subject: `You are confirmed for ${ev?.title ?? "the event"}`,
        body: textToHtml(
          `${greeting ? `Hello ${greeting},\n\n` : ""}${message}\n\nOpen EventFlow to view your ticket: /events/${eventId}`,
        ),
      }).catch(() => undefined)
    }
  }

  return mapRegistration({ ...row, status: "confirmed" })
}

export async function cancelRegistration(id: string): Promise<boolean> {
  const { data: reg, error: fetchError } = await supabase
    .from("registrations")
    .select("event_id, status, attendance_mode, event:events(event_type)")
    .eq("id", id)
    .maybeSingle()
  if (fetchError) throw fetchError
  if (!reg) return false

  const { error: updateError } = await supabase
    .from("registrations")
    .update({ status: "cancelled" })
    .eq("id", id)
  if (updateError) throw updateError

  // Only promote a waitlisted attendee when a *confirmed* spot was freed.
  if (reg.status === "confirmed") {
    const ev: any = (reg as any).event
    await promoteFirstWaitlisted(
      reg.event_id,
      ev?.event_type === "hybrid" ? ((reg as any).attendance_mode ?? "in_person") : undefined,
    )
  }

  return true
}

/**
 * Organizer/admin hard-delete: the row is removed so the user may register
 * again. A confirmed deletion auto-promotes the next waitlisted attendee.
 */
export async function deleteRegistrationHard(registrationId: string, reason?: string): Promise<boolean> {
  const { data: reg } = await supabase
    .from("registrations")
    .select("id, event_id, attendee_id, status, attendance_mode, event:events(title, event_type)")
    .eq("id", registrationId)
    .maybeSingle()
  if (!reg) return false

  const { data: tickets } = await supabase.from("tickets").select("id").eq("registration_id", registrationId)
  const ticketIds = (tickets ?? []).map((t) => t.id)
  if (ticketIds.length > 0) {
    await supabase.from("attendance").delete().in("ticket_id", ticketIds)
    await supabase.from("tickets").delete().in("id", ticketIds)
  }
  const { error } = await supabase.from("registrations").delete().eq("id", registrationId)
  if (error) throw error

  const { data: prof } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("id", reg.attendee_id)
    .maybeSingle()
  if (prof) {
    const eventTitle = (reg as any).event?.title ?? "the event"
    await sendNotification(
      prof.user_id,
      "registration_removed",
      `Your registration for "${eventTitle}" was removed by the organizer.${reason?.trim() ? ` Reason: ${reason.trim()}.` : ""} You can register again if seats are available.`,
      `/events/${reg.event_id}`,
    ).catch(() => undefined)
  }

  if (reg.status === "confirmed") {
    const ev: any = (reg as any).event
    await promoteFirstWaitlisted(
      reg.event_id,
      ev?.event_type === "hybrid" ? ((reg as any).attendance_mode ?? "in_person") : undefined,
    )
  }

  return true
}

export async function getAllRegistrations(): Promise<Registration[]> {
  const { data, error } = await supabase
    .from("registrations")
    .select("*")
  if (error) throw error
  return data.map(mapRegistration)
}

export async function getRegistrationsByAttendee(attendeeId: string): Promise<Registration[]> {
  const { data, error } = await supabase
    .from("registrations")
    .select("*")
    .eq("attendee_id", attendeeId)
    .order("registered_at", { ascending: false })
  if (error) throw error
  return data.map(mapRegistration)
}

export async function getFeedback(eventId: string): Promise<Feedback[]> {
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("event_id", eventId)
    .order("submitted_at", { ascending: false })
  if (error) throw error
  return data.map(mapFeedback)
}

export async function submitFeedback(data: Omit<Feedback, "id">): Promise<Feedback> {
  const { data: inserted, error } = await supabase
    .from("feedback")
    .insert({
      event_id: data.eventId,
      attendee_id: data.attendeeId,
      rating: data.rating,
      comment: data.comment,
    })
    .select()
    .single()
  if (error) throw error
  return mapFeedback(inserted)
}

// --- Mappers ---

function mapEvent(e: Record<string, any>): Event {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    coverImageUrl: e.cover_image_url,
    organizerId: e.organizer_id,
    venueId: e.venue_id,
    capacity: e.capacity,
    registrationDeadline: e.registration_deadline,
    startDate: e.start_date,
    endDate: e.end_date,
    status: e.status,
    visibility: e.visibility,
    contactEmail: e.contact_email,
    categoryId: e.category_id,
    eventType: e.event_type === "online" ? "online" : e.event_type === "hybrid" ? "hybrid" : "in_person",
    meetingLink: e.meeting_link ?? undefined,
    meetingLinkGeneratedBy: e.meeting_link_generated_by ?? undefined,
    meetingLinkCreatedAt: e.meeting_link_created_at ?? undefined,
    onlineCapacity: e.online_capacity ?? undefined,
    inPersonCapacity: e.in_person_capacity ?? undefined,
    meetingProvider: e.meeting_provider ?? undefined,
    meetingAttendanceMinutes: e.meeting_attendance_minutes ?? undefined,
    meetingRoomName: e.meeting_room_name ?? undefined,
    hybridNote: e.hybrid_note ?? undefined,
    deletedAt: e.deleted_at ?? undefined,
  }
}

function toDbEvent(e: Omit<Event, "id">): Record<string, unknown> {
  return {
    title: e.title,
    description: e.description,
    cover_image_url: e.coverImageUrl,
    organizer_id: e.organizerId,
    venue_id: e.venueId || null,
    capacity: e.capacity,
    registration_deadline: e.registrationDeadline,
    start_date: e.startDate,
    end_date: e.endDate,
    status: e.status,
    visibility: e.visibility,
    contact_email: e.contactEmail,
    category_id: e.categoryId,
    event_type: e.eventType,
    meeting_link: e.meetingLink ?? null,
    online_capacity: e.onlineCapacity ?? null,
    in_person_capacity: e.inPersonCapacity ?? null,
    meeting_provider: e.meetingProvider ?? "jitsi",
    meeting_attendance_minutes: e.meetingAttendanceMinutes ?? 10,
    meeting_room_name: e.meetingRoomName ?? null,
    hybrid_note: e.hybridNote ?? null,
  }
}

function mapSession(s: Record<string, any>): Session {
  return {
    id: s.id,
    eventId: s.event_id,
    title: s.title,
    description: s.description,
    startTime: s.start_time,
    endTime: s.end_time,
    roomName: s.room_name,
  }
}

function mapSpeaker(s: Record<string, any>): Speaker {
  return {
    id: s.id,
    sessionId: s.session_id,
    name: s.name,
    bio: s.bio,
    imageUrl: s.image_url,
  }
}

function mapRegistration(r: Record<string, any>): Registration {
  return {
    id: r.id,
    eventId: r.event_id,
    attendeeId: r.attendee_id,
    registeredAt: r.registered_at,
    status: r.status,
    attendanceMode: r.attendance_mode ?? undefined,
  }
}

function mapFeedback(f: Record<string, any>): Feedback {
  return {
    id: f.id,
    eventId: f.event_id,
    attendeeId: f.attendee_id,
    rating: f.rating,
    comment: f.comment,
    submittedAt: f.submitted_at,
    response: f.response ?? undefined,
    respondedAt: f.responded_at ?? undefined,
  }
}

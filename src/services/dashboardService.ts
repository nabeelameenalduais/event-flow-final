import { supabase } from "../lib/supabase"
import type { Event } from "../types"

function firstError(...results: { error: any }[]): any {
  return results.find((r) => r.error)?.error ?? null
}

export async function getAdminStats() {
  const results = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("events").select("*", { count: "exact", head: true }),
    supabase.from("events").select("*", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("registrations").select("*", { count: "exact", head: true }),
    supabase.from("registrations").select("*", { count: "exact", head: true }).eq("status", "confirmed"),
    supabase.from("venues").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("categories").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("feedback").select("*", { count: "exact", head: true }),
  ])
  const error = firstError(...results)
  if (error) throw error

  return {
    totalUsers: results[0].count ?? 0,
    totalEvents: results[1].count ?? 0,
    publishedEvents: results[2].count ?? 0,
    totalRegistrations: results[3].count ?? 0,
    confirmedRegistrations: results[4].count ?? 0,
    totalVenues: results[5].count ?? 0,
    totalCategories: results[6].count ?? 0,
    totalFeedback: results[7].count ?? 0,
  }
}

export async function getRecentActivity() {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("action, details, created_at")
    .order("created_at", { ascending: false })
    .limit(5)
  if (error) throw error
  if (!data) return []

  return data.map((log) => ({
    action: log.action,
    detail: log.details,
    time: formatRelativeTime(log.created_at),
  }))
}

export async function getUpcomingEvents(limit = 5) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("status", "published")
    .gte("start_date", new Date().toISOString())
    .order("start_date")
    .limit(limit)
  if (error) throw error
  return (data ?? []).map(mapEvent)
}

export async function getOrganizerStats(organizerId: string) {
  const { data: myEvents, error: eventsError } = await supabase
    .from("events")
    .select("*")
    .eq("organizer_id", organizerId)
    .is("deleted_at", null)
    .order("start_date")
  if (eventsError) throw eventsError

  const events = myEvents ?? []
  const myEventIds = events.map((e) => e.id)

  let totalRegs = 0
  let confirmedRegs = 0
  if (myEventIds.length > 0) {
    const results = await Promise.all([
      supabase
        .from("registrations")
        .select("*", { count: "exact", head: true })
        .in("event_id", myEventIds),
      supabase
        .from("registrations")
        .select("*", { count: "exact", head: true })
        .in("event_id", myEventIds)
        .eq("status", "confirmed"),
    ])
    const error = firstError(...results)
    if (error) throw error
    totalRegs = results[0].count ?? 0
    confirmedRegs = results[1].count ?? 0
  }

  return {
    totalEvents: events.length,
    publishedEvents: events.filter((e) => e.status === "published").length,
    draftEvents: events.filter((e) => e.status === "draft").length,
    totalRegistrations: totalRegs,
    confirmedRegistrations: confirmedRegs,
    events: events.map(mapEvent),
  }
}

/**
 * Split registered events into upcoming / in progress / past. An event that
 * has started but not ended must stay visible — it belongs in neither of the
 * two exclusive buckets used previously, which made it disappear entirely.
 */
export function classifyAttendeeEvents(events: Event[], now: Date = new Date()) {
  const time = now.getTime()
  return {
    upcomingEvents: events.filter((e) => new Date(e.startDate).getTime() > time),
    ongoingEvents: events.filter((e) => {
      const start = new Date(e.startDate).getTime()
      const end = new Date(e.endDate).getTime()
      return start <= time && end >= time
    }),
    pastEvents: events.filter((e) => new Date(e.endDate).getTime() < time),
  }
}

export async function getAttendeeStats(attendeeId: string) {
  const { data: myRegs, error: regsError } = await supabase
    .from("registrations")
    .select("*")
    .eq("attendee_id", attendeeId)
  if (regsError) throw regsError

  const regs = myRegs ?? []
  const myEventIds = regs.map((r) => r.event_id)

  const { data: myEvents, error: eventsError } = myEventIds.length > 0
    ? await supabase.from("events").select("*").in("id", myEventIds)
    : { data: [], error: null }
  if (eventsError) throw eventsError

  const events = (myEvents ?? []).map(mapEvent).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
  const eventById = new Map(events.map((e) => [e.id, e]))

  return {
    totalRegistered: regs.length,
    confirmedRegistrations: regs.filter((r) => r.status === "confirmed").length,
    ...classifyAttendeeEvents(events),
    tickets: regs.map((r) => ({
      event: eventById.get(r.event_id),
      status: r.status,
      registeredAt: r.registered_at,
    })),
  }
}

export async function getNotifications(userId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map((n: Record<string, any>) => ({
    id: n.id,
    userId: n.user_id,
    type: n.type,
    message: n.message,
    readAt: n.read_at ?? null,
    createdAt: n.created_at,
  }))
}

export interface RegistrationTrend {
  label: string
  count: number
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

/** Build a real trailing-7-day series (including empty days) from timestamps. */
export function buildRegistrationTrends(
  registeredAt: string[],
  now: Date = new Date(),
  days = 7,
): RegistrationTrend[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1))
  const counts = new Map<string, number>()
  const dates: Date[] = []

  for (let i = 0; i < days; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    dates.push(day)
    counts.set(dateKey(day), 0)
  }

  for (const timestamp of registeredAt) {
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime()) || date < start || date > now) continue
    const key = dateKey(date)
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return dates.map((date) => ({
    label: date.toLocaleDateString("en-US", { weekday: "short" }),
    count: counts.get(dateKey(date)) ?? 0,
  }))
}

export async function getRegistrationTrends(): Promise<RegistrationTrend[]> {
  const start = new Date()
  start.setDate(start.getDate() - 7)
  const { data, error } = await supabase
    .from("registrations")
    .select("registered_at")
    .gte("registered_at", start.toISOString())
  if (error) throw error
  return buildRegistrationTrends((data ?? []).map((r) => r.registered_at))
}

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
    eventType: e.event_type === "hybrid" ? "hybrid" : e.event_type === "online" ? "online" : "in_person",
    deletedAt: e.deleted_at ?? undefined,
  }
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} minute${mins > 1 ? "s" : ""} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? "s" : ""} ago`
}

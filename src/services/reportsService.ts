import { runtimeFormatDateTime as formatDateTime } from "../i18n/runtimeLocale"
import { supabase } from "../lib/supabase"

export type ReportModeFilter = "all" | "online" | "in_person"

export async function getReportData(modeFilter: ReportModeFilter = "all") {
  const results = await Promise.all([
    supabase.from("events").select("id, title, status, capacity, online_capacity, in_person_capacity, category_id, venue_id, event_type, start_date, end_date").order("start_date"),
    supabase.from("registrations").select("id, event_id, attendee_id, status, attendance_mode, registered_at"),
    supabase.from("categories").select("id, name"),
    supabase.from("feedback").select("id, event_id, rating, submitted_at"),
    supabase.from("users").select("id, email, suspended, created_at"),
    supabase.from("profiles").select("id, user_id, first_name, last_name, role_id, role:roles(name)"),
    supabase.from("venues").select("id, name"),
    supabase.from("tickets").select("id, registration_id, status"),
    supabase.from("attendance").select("id, ticket_id, check_in_time, mode"),
    supabase.from("event_costs").select("event_id, cost_type, need_type, quantity, unit_price"),
    supabase.from("evaluations").select("id, event_id, rating_type"),
  ])
  const failed = results.find((result) => result.error)
  if (failed?.error) throw new Error(failed.error.message)

  const [events, registrations, categories, feedbacks, users, profiles, venues, tickets, attendance, costs, evaluations] = results

  const evs = (events.data ?? []) as any[]
  const allRegs = (registrations.data ?? []) as any[]
  const cats = (categories.data ?? []) as any[]
  const fbs = (feedbacks.data ?? []) as any[]
  const usrs = (users.data ?? []) as any[]
  const profs = (profiles.data ?? []) as any[]
  const vens = (venues.data ?? []) as any[]
  const tks = (tickets.data ?? []) as any[]
  const atts = (attendance.data ?? []) as any[]
  const csts = (costs.data ?? []) as any[]
  const evals = (evaluations.data ?? []) as any[]

  // Resolve each registration to an attendance mode. Hybrid events carry the
  // mode on the registration; legacy online/in-person events fall back to the
  // event type.
  const eventById = new Map(evs.map((e) => [e.id, e]))
  const regMode = (r: any): "online" | "in_person" => {
    if (r.attendance_mode === "online") return "online"
    if (r.attendance_mode === "in_person") return "in_person"
    return eventById.get(r.event_id)?.event_type === "online" ? "online" : "in_person"
  }
  const regs = modeFilter === "all" ? allRegs : allRegs.filter((r) => regMode(r) === modeFilter)

  // ---------- Overview ----------
  const totalEvents = evs.length
  const totalUsers = usrs.length
  const totalRegs = regs.length
  const confirmedRegs = regs.filter((r) => r.status === "confirmed").length
  const cancelledRegs = regs.filter((r) => r.status === "cancelled").length
  const waitlistedRegs = regs.filter((r) => r.status === "waitlisted").length
  const totalAttendance = modeFilter === "all"
    ? atts.length
    : atts.filter((a) => a.mode === modeFilter || (!a.mode && modeFilter === "in_person")).length
  const averageRating = fbs.length > 0
    ? +(fbs.reduce((s, f) => s + f.rating, 0) / fbs.length).toFixed(1)
    : 0

  // ---------- Users section ----------
  const roleNames = ["admin", "organizer", "attendee"]
  const usersByRole = roleNames.map((name) => ({
    name,
    count: profs.filter((p) => p.role?.name === name).length,
  }))

  const suspendedCount = usrs.filter((u) => u.suspended).length

  // Attendance commitment: users who registered to events they attended vs registered but never attended
  const profileToUser = new Map(profs.map((p) => [p.id, p.user_id]))
  const attendanceCountByProfile: Record<string, number> = {}
  const ticketRegMap = new Map(tks.map((t) => [t.id, t.registration_id]))
  for (const a of atts) {
    const regId = ticketRegMap.get(a.ticket_id)
    if (!regId) continue
    const reg = regs.find((r) => r.id === regId)
    if (reg) {
      attendanceCountByProfile[reg.attendee_id] = (attendanceCountByProfile[reg.attendee_id] ?? 0) + 1
    }
  }
  const attendedProfileIds = new Set(Object.keys(attendanceCountByProfile))

  const activeAttendees = new Set(profs.filter((p) => p.role?.name === "attendee").map((p) => p.id))
  let attendedCount = 0
  let noShowCount = 0
  const attendeeSet = new Set<string>()
  for (const r of regs) {
    if (r.status !== "cancelled" && activeAttendees.has(r.attendee_id)) {
      attendeeSet.add(r.attendee_id)
    }
  }
  for (const id of attendeeSet) {
    if (attendedProfileIds.has(id)) attendedCount++
    else noShowCount++
  }

  // Attendance commitment across all registered users (not just attendees)
  let allRegistered = 0
  let allAttended = 0
  for (const r of regs) {
    if (r.status !== "cancelled") {
      allRegistered++
      if (attendedProfileIds.has(r.attendee_id)) allAttended++
    }
  }

  const topAttendees = Object.entries(attendanceCountByProfile)
    .map(([profileId, attended]) => {
      const prof = profs.find((p) => p.id === profileId)
      return {
        profileId,
        userId: profileToUser.get(profileId),
        name: prof ? `${prof.first_name} ${prof.last_name}`.trim() || "Unknown" : "Unknown",
        attended,
      }
    })
    .sort((a, b) => b.attended - a.attended)
    .slice(0, 10)

  // ---------- Events section ----------
  const eventPopularity = evs
    .map((e) => ({
      id: e.id,
      name: e.title,
      registrations: regs.filter((r) => r.event_id === e.id && r.status !== "cancelled").length,
    }))
    .sort((a, b) => b.registrations - a.registrations)

  const attendanceRateByEvent = evs.map((e) => {
    const eventRegs = regs.filter((r) => r.event_id === e.id && r.status !== "cancelled")
    const eventTickets = eventRegs
      .map((r) => tks.find((t) => t.registration_id === r.id))
      .filter(Boolean)
    const attended = eventTickets.filter((t) => atts.some((a) => a.ticket_id === t.id)).length
    const eventAll = regs.filter((r) => r.event_id === e.id)
    return {
      id: e.id,
      name: e.title,
      status: e.status,
      registered: eventRegs.length,
      confirmed: eventAll.filter((r) => r.status === "confirmed").length,
      cancelled: eventAll.filter((r) => r.status === "cancelled").length,
      waitlisted: eventAll.filter((r) => r.status === "waitlisted").length,
      online: eventRegs.filter((r) => regMode(r) === "online").length,
      inPerson: eventRegs.filter((r) => regMode(r) === "in_person").length,
      attended,
      rate: eventRegs.length > 0 ? Math.round((attended / eventRegs.length) * 100) : 0,
      fillRate: e.capacity > 0 ? Math.round((eventRegs.length / e.capacity) * 100) : 0,
    }
  })

  const eventsByStatus = ["draft", "published", "archived"].map((s) => ({
    name: s,
    count: evs.filter((e) => e.status === s).length,
  }))

  // ---------- Attendance section ----------
  // Count by the attendee's chosen mode so hybrid events are split correctly.
  const attendanceByMode = (["in_person", "online"] as const).map((mode) => {
    const modeRegs = allRegs.filter((r) => r.status !== "cancelled" && regMode(r) === mode)
    const attended = modeRegs.filter((r) => {
      const ticket = tks.find((t) => t.registration_id === r.id)
      return ticket ? atts.some((a) => a.ticket_id === ticket.id) : false
    }).length
    return {
      mode,
      name: mode === "online" ? "Online" : "In-Person",
      confirmed: modeRegs.length,
      attended,
    }
  })
  const attendanceByType = attendanceByMode.map((m) => ({ name: m.name, value: m.attended }))

  // ---------- Feedback / evaluation ----------
  const ratingDistMap: Record<string, number> = {}
  for (const f of fbs) {
    const key = String(f.rating)
    ratingDistMap[key] = (ratingDistMap[key] ?? 0) + 1
  }
  const ratingDistribution = Object.entries(ratingDistMap)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => Number(a.label) - Number(b.label))

  const avgRatingByEvent = evs
    .map((e) => {
      const eventFb = fbs.filter((f) => f.event_id === e.id)
      return {
        id: e.id,
        name: e.title,
        count: eventFb.length,
        average: eventFb.length > 0
          ? +(eventFb.reduce((s, f) => s + f.rating, 0) / eventFb.length).toFixed(1)
          : 0,
      }
    })
    .filter((e) => e.count > 0)
    .sort((a, b) => b.average - a.average)

  // ---------- Costs section ----------
  const costsByEvent = evs.map((e) => {
    const planned = csts.filter((c) => c.event_id === e.id && c.cost_type === "planned")
    const actual = csts.filter((c) => c.event_id === e.id && c.cost_type === "actual")
    const plannedTotal = planned.reduce((s, c) => s + Number(c.quantity) * Number(c.unit_price), 0)
    const actualTotal = actual.reduce((s, c) => s + Number(c.quantity) * Number(c.unit_price), 0)
    return {
      id: e.id,
      name: e.title,
      planned: plannedTotal,
      actual: actualTotal,
      difference: plannedTotal - actualTotal,
    }
  })
  const totalPlannedCosts = csts.filter((c) => c.cost_type === "planned")
    .reduce((s, c) => s + Number(c.quantity) * Number(c.unit_price), 0)
  const totalActualCosts = csts.filter((c) => c.cost_type === "actual")
    .reduce((s, c) => s + Number(c.quantity) * Number(c.unit_price), 0)

  const needTypeDist: Record<string, number> = {}
  for (const c of csts) {
    needTypeDist[c.need_type] = (needTypeDist[c.need_type] ?? 0) + 1
  }

  // ---------- Categories & venues ----------
  const categoryBreakdown = cats
    .map((c) => ({
      name: c.name,
      count: evs.filter((e) => e.category_id === c.id).length,
    }))
    .filter((c) => c.count > 0)

  const venueBreakdown = vens
    .map((v) => ({
      name: v.name,
      count: evs.filter((e) => e.venue_id === v.id).length,
    }))
    .filter((v) => v.count > 0)

  // ---------- Registration trend ----------
  // Grouped by year-month so the same month in different years stays
  // separate (فصل الأشهر), and sorted chronologically.
  const regByMonth: Record<string, number> = {}
  for (const r of regs) {
    const d = new Date(r.registered_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    regByMonth[key] = (regByMonth[key] || 0) + 1
  }
  const registrationTrend = Object.entries(regByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => {
      const [year, month] = key.split("-")
      const label = formatDateTime(new Date(Number(year), Number(month) - 1, 1), { month: "short", year: "numeric" })
      return { key, month: label, count }
    })

  const statusPie = [
    { name: "Confirmed", value: confirmedRegs },
    { name: "Cancelled", value: cancelledRegs },
    { name: "Waitlisted", value: waitlistedRegs },
  ].filter((d) => d.value > 0)

  return {
    modeFilter,
    summary: {
      totalEvents, totalUsers, totalRegs, confirmedRegs, cancelledRegs, waitlistedRegs,
      totalAttendance, averageRating,
      totalPlannedCosts, totalActualCosts,
    },
    registrationTrend,
    statusPie,
    categoryBreakdown,
    venueBreakdown,
    eventPopularity,
    eventsByStatus,
    usersByRole,
    suspendedCount,
    attendanceCommitment: { attended: attendedCount, noShow: noShowCount, allRegistered, allAttended },
    topAttendees,
    attendanceRateByEvent,
    attendanceByType,
    attendanceByMode,
    ratingDistribution,
    avgRatingByEvent,
    costsByEvent,
    needTypeDist,
    events: evs,
    venues: vens,
    categories: cats,
    evaluations: evals,
  }
}

export function exportToCsv(data: Record<string, any>[], filename: string) {
  if (data.length === 0) return
  const headers = Object.keys(data[0])
  const rows = data.map((row) => headers.map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(","))
  const csv = [headers.join(","), ...rows].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

import { runtimeFormatDate as formatDate } from "../i18n/runtimeLocale"
import { supabase } from "../lib/supabase"
import type { AttendanceMode, Ticket } from "../types"
import QRCode from "qrcode"
import {
  buildTicketPayload,
  encodeTicketCode,
  generateUniqueCode,
} from "./ticketCode"

// Kept as re-exports so existing callers keep working.
export { encodeTicketCode, decodeTicketCode, buildTicketPayload } from "./ticketCode"
export type { TicketPayload } from "./ticketCode"

const MAX_CODE_RETRIES = 5

function mapTicket(t: Record<string, any>): Ticket {
  return {
    id: t.id,
    registrationId: t.registration_id,
    uniqueCode: t.unique_code,
    qrCodeUrl: t.qr_code_url,
    issuedAt: t.issued_at,
    status: t.status,
    qrPayload: t.qr_payload ?? undefined,
    attendanceMode: t.attendance_mode ?? undefined,
    verifiedBy: t.verified_by ?? undefined,
    verifiedAt: t.verified_at ?? undefined,
    eventId: t.event_id ?? (t.registration as any)?.event_id ?? undefined,
    attendeeId: (t.registration as any)?.attendee_id ?? undefined,
  }
}

export async function generateTicket(
  registrationId: string,
  _eventTitle: string,
  attendanceMode?: AttendanceMode,
  eventId?: string,
): Promise<Ticket> {
  let resolvedEventId = eventId
  if (!resolvedEventId || !attendanceMode) {
    const { data: reg } = await supabase
      .from("registrations")
      .select("event_id, attendance_mode")
      .eq("id", registrationId)
      .maybeSingle()
    resolvedEventId = resolvedEventId ?? (reg as any)?.event_id
    attendanceMode = attendanceMode ?? ((reg as any)?.attendance_mode ?? undefined)
  }
  if (!resolvedEventId) throw new Error("Cannot generate a ticket without an event")

  // Idempotent: a retry must never issue a second ticket for one registration.
  const existing = await getTicketByRegistration(registrationId)
  if (existing) return existing

  for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt += 1) {
    const uniqueCode = generateUniqueCode()
    const payload = encodeTicketCode(
      buildTicketPayload({
        code: uniqueCode,
        eventId: resolvedEventId,
        registrationId,
        mode: attendanceMode,
      }),
    )
    const qrDataUrl = await QRCode.toDataURL(payload, { width: 300, margin: 2 })

    const { data, error } = await supabase
      .from("tickets")
      .insert({
        registration_id: registrationId,
        unique_code: uniqueCode,
        qr_code_url: qrDataUrl,
        qr_payload: payload,
        attendance_mode: attendanceMode ?? null,
      })
      .select()
      .single()

    if (!error && data) return mapTicket(data)

    // 23505 = unique violation. Either the random code collided (retry with a
    // fresh one) or another request won the registration_id race (reuse it).
    if (error?.code === "23505") {
      if (error.message?.includes("registration_id")) {
        const raced = await getTicketByRegistration(registrationId)
        if (raced) return raced
      }
      continue
    }
    throw error
  }
  throw new Error("Could not generate a unique ticket code")
}

export async function getTicketByRegistration(registrationId: string): Promise<Ticket | undefined> {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("registration_id", registrationId)
    .maybeSingle()
  if (error) throw error
  return data ? mapTicket(data) : undefined
}

export async function getTicketById(id: string): Promise<Ticket | undefined> {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", id)
    .single()
  if (error) throw error
  return data ? mapTicket(data) : undefined
}

/**
 * Loads a ticket only when it belongs to the given attendee profile (confirmed registration),
 * otherwise returns undefined. Used to keep the ticket page from leaking others' tickets.
 */
export async function getTicketForOwner(id: string, attendeeProfileId: string): Promise<Ticket | undefined> {
  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("*, registration:registrations(attendee_id, status, attendance_mode)")
    .eq("id", id)
    .single()
  if (error) throw error
  if (!ticket) return undefined
  const reg = (ticket as any).registration
  if (!reg || reg.attendee_id !== attendeeProfileId || reg.status !== "confirmed") return undefined
  return mapTicket(ticket)
}

export async function getTicketsByIds(ids: string[]): Promise<Ticket[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .in("id", ids)
  if (error) throw error
  return (data ?? []).map(mapTicket)
}

/** Load all tickets for a set of registrations in one query. */
export async function getTicketsByRegistrations(registrationIds: string[]): Promise<Ticket[]> {
  const ids = [...new Set(registrationIds)]
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .in("registration_id", ids)
  if (error) throw error
  return (data ?? []).map(mapTicket)
}

export async function markTicketVerified(ticketId: string, userId: string): Promise<void> {
  await supabase
    .from("tickets")
    .update({ verified_by: userId, verified_at: new Date().toISOString() })
    .eq("id", ticketId)
    .then(() => undefined, () => undefined)
}

export async function downloadTicket(id: string): Promise<void> {
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*, registration:registrations(event_id, attendance_mode, event:events(event_type))")
    .eq("id", id)
    .single()
  if (!ticket) throw new Error("Ticket not found")

  const registration: any = (ticket as any).registration
  const attendanceMode: AttendanceMode | undefined =
    ticket.attendance_mode ?? registration?.attendance_mode ??
    (registration?.event?.event_type === "online" ? "online" : undefined)
  const payload = ticket.qr_payload
    ? ticket.qr_payload
    : encodeTicketCode(buildTicketPayload({
        code: ticket.unique_code,
        eventId: registration?.event_id,
        registrationId: ticket.registration_id,
        mode: attendanceMode,
      }))
  // Always render from the canonical payload so the printed QR verifies
  // against the right event even for legacy tickets with no stored payload.
  const qrUrl = await QRCode.toDataURL(payload, { width: 300, margin: 2 })
  const modeLabel = attendanceMode === "online" ? "Online" : attendanceMode === "in_person" ? "In person" : ""

  const canvas = document.createElement("canvas")
  canvas.width = 600
  canvas.height = 430
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, 600, 430)
  ctx.strokeStyle = "#000000"
  ctx.lineWidth = 2
  ctx.strokeRect(10, 10, 580, 410)
  ctx.fillStyle = "#000000"
  ctx.font = "bold 24px sans-serif"
  ctx.textAlign = "center"
  ctx.fillText("EVENT TICKET", 300, 60)
  ctx.font = "16px sans-serif"
  ctx.fillText(`Code: ${ticket.unique_code}`, 300, 110)
  if (modeLabel) ctx.fillText(`Attendance: ${modeLabel}`, 300, 135)
  ctx.font = "14px sans-serif"
  ctx.fillText(`Issued: ${formatDate(ticket.issued_at)}`, 300, 160)
  ctx.fillText(`Status: ${ticket.status}`, 300, 185)

  return new Promise<void>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 200, 205, 200, 200)
      const link = document.createElement("a")
      link.download = `ticket-${ticket.unique_code}.png`
      link.href = canvas.toDataURL()
      link.click()
      resolve()
    }
    img.onerror = () => reject(new Error("Failed to load QR image"))
    img.src = qrUrl
  })
}

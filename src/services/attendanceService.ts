import { supabase } from "../lib/supabase"
import { getSessionToken } from "../lib/session"
import { decodeTicketCode, verifyTicketPayload } from "./ticketCode"
import type { Attendance, AttendanceMode, AttendanceSource, Ticket } from "../types"

export type TicketErrorCode =
  | "not_found"
  | "wrong_event"
  | "invalid_registration"
  | "payload_mismatch"
  | "invalid_ticket"
  | "already_used"
  | "unauthorized"

export class TicketError extends Error {
  code: TicketErrorCode
  details: Record<string, any>

  constructor(code: TicketErrorCode, message: string, details: Record<string, any> = {}) {
    super(message)
    this.name = "TicketError"
    this.code = code
    this.details = details
  }
}

function mapAttendance(a: Record<string, any>): Attendance {
  return {
    id: a.id,
    ticketId: a.ticket_id,
    checkInTime: a.check_in_time,
    checkOutTime: a.check_out_time ?? undefined,
    mode: a.mode ?? undefined,
    source: a.source ?? "manual",
    verifiedBy: a.verified_by ?? undefined,
    presenceSeconds: a.presence_seconds ?? undefined,
  }
}

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
  }
}

export interface CheckInOptions {
  mode?: AttendanceMode
  source?: AttendanceSource
  /** Kept for call-site compatibility — the RPC derives this from the session. */
  verifiedBy?: string
  /** Event whose attendance is being checked. The RPC rejects a mismatch. */
  expectedEventId?: string
}

interface RpcCheckInResult {
  ok: boolean
  error?: TicketErrorCode
  message?: string
  checkInTime?: string
  checkOutTime?: string | null
  attendance?: Record<string, any>
}

/**
 * Atomic check-in. The database function resolves the caller from the session
 * token, checks organizer rights for this event, locks the ticket row,
 * verifies event/registration/status, records attendance and consumes the
 * ticket in one transaction — so two concurrent scans cannot both succeed.
 */
export async function checkIn(ticketId: string, options: CheckInOptions = {}): Promise<Attendance> {
  const { data, error } = await supabase.rpc("check_in_ticket", {
    p_ticket_id: ticketId,
    p_expected_event_id: options.expectedEventId ?? null,
    p_mode: options.mode ?? null,
    p_source: options.source ?? "manual",
    p_session_token: getSessionToken(),
  })
  if (error) throw error

  const result = data as RpcCheckInResult | null
  if (!result) throw new Error("Check-in returned no result")
  if (!result.ok) {
    throw new TicketError(result.error ?? "not_found", result.message ?? "Check-in failed", {
      checkInTime: result.checkInTime,
      checkOutTime: result.checkOutTime,
    })
  }
  if (!result.attendance) throw new Error("Check-in did not return an attendance record")

  const a = result.attendance
  return {
    id: a.id,
    ticketId: a.ticketId ?? a.ticket_id,
    checkInTime: a.checkInTime ?? a.check_in_time,
    checkOutTime: a.checkOutTime ?? a.check_out_time ?? undefined,
    mode: a.mode ?? undefined,
    source: a.source ?? undefined,
    verifiedBy: a.verifiedBy ?? a.verified_by ?? undefined,
  }
}

export async function checkOut(attendanceId: string): Promise<Attendance | undefined> {
  const { data, error } = await supabase
    .from("attendance")
    .update({ check_out_time: new Date().toISOString() })
    .eq("id", attendanceId)
    .select()
    .single()
  if (error) throw error
  return data ? mapAttendance(data) : undefined
}

export async function getAttendanceByEvent(eventId: string): Promise<(Attendance & { ticket: Ticket | undefined })[]> {
  const { data: regs, error: regsError } = await supabase
    .from("registrations")
    .select("id")
    .eq("event_id", eventId)
  if (regsError) throw regsError
  if (!regs || regs.length === 0) return []

  const regIds = regs.map((r) => r.id)

  const { data: eventTickets, error: ticketsError } = await supabase
    .from("tickets")
    .select("*")
    .in("registration_id", regIds)
  if (ticketsError) throw ticketsError
  if (!eventTickets || eventTickets.length === 0) return []

  const ticketIds = eventTickets.map((t) => t.id)

  const { data: attendanceRecords, error: attendanceError } = await supabase
    .from("attendance")
    .select("*")
    .in("ticket_id", ticketIds)
  if (attendanceError) throw attendanceError
  if (!attendanceRecords) return []

  const ticketMap = Object.fromEntries(eventTickets.map((t) => [t.id, mapTicket(t)]))
  return attendanceRecords.map((a) => ({ ...mapAttendance(a), ticket: ticketMap[a.ticket_id] }))
}

export async function getAttendanceByTicket(ticketId: string): Promise<Attendance | undefined> {
  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("ticket_id", ticketId)
    .maybeSingle()
  if (error) throw error
  return data ? mapAttendance(data) : undefined
}

/**
 * Accepts an encoded QR payload or a manually typed unique code.
 * Verifies that the payload matches the ticket it resolved to and, when an
 * event is supplied, that the ticket belongs to that event.
 */
export async function findTicketByCode(code: string, expectedEventId?: string): Promise<Ticket> {
  const decoded = decodeTicketCode(code)
  if (!decoded.code) throw new TicketError("not_found", "No ticket found with that code")

  const { data, error } = await supabase
    .from("tickets")
    .select("*, registration:registrations(id, event_id, attendee_id, status, attendance_mode)")
    .eq("unique_code", decoded.code.toUpperCase())
    .maybeSingle()
  if (error) throw error
  if (!data) throw new TicketError("not_found", "No ticket found with that code")

  const reg: any = (data as any).registration
  if (!reg || reg.status !== "confirmed") {
    throw new TicketError("invalid_registration", "This ticket's registration is not confirmed")
  }

  const mismatch = verifyTicketPayload(decoded.payload, {
    code: data.unique_code,
    eventId: reg.event_id,
    registrationId: data.registration_id,
  })
  if (mismatch) {
    throw new TicketError("payload_mismatch", "This QR code does not match the ticket it identifies")
  }

  if (expectedEventId && reg.event_id !== expectedEventId) {
    throw new TicketError("wrong_event", "This ticket is not valid for the event being checked")
  }

  return { ...mapTicket(data), eventId: reg.event_id, attendeeId: reg.attendee_id }
}

export async function findTicketByAttendee(eventId: string, attendeeId: string): Promise<Ticket | undefined> {
  const { data: reg } = await supabase
    .from("registrations")
    .select("id")
    .eq("event_id", eventId)
    .eq("attendee_id", attendeeId)
    .eq("status", "confirmed")
    .maybeSingle()

  if (!reg) return undefined

  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("registration_id", reg.id)
    .maybeSingle()
  if (error) throw error
  return data ? mapTicket(data) : undefined
}

/**
 * Marks auto-attendance when the attendee opens the meeting link. Online/hybrid
 * attendees are recorded with the correct mode and source. Idempotent.
 */
export async function markAutoAttendance(
  eventId: string,
  attendeeId: string,
  source: AttendanceSource = "auto_join",
): Promise<void> {
  const { data: reg } = await supabase
    .from("registrations")
    .select("id, attendance_mode, event:events(event_type)")
    .eq("event_id", eventId)
    .eq("attendee_id", attendeeId)
    .eq("status", "confirmed")
    .maybeSingle()
  if (!reg) return

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, attendance_mode")
    .eq("registration_id", reg.id)
    .maybeSingle()
  if (!ticket) return

  const { data: existing } = await supabase
    .from("attendance")
    .select("id")
    .eq("ticket_id", ticket.id)
    .maybeSingle()
  if (existing) return

  const event: any = (reg as any).event
  const mode: AttendanceMode =
    (ticket as any).attendance_mode ||
    (reg as any).attendance_mode ||
    (event?.event_type === "online" ? "online" : "online")

  await supabase.from("tickets").update({ status: "used" }).eq("id", ticket.id)
  const row = { ticket_id: ticket.id, mode, source }
  const { error } = await supabase.from("attendance").insert(row)
  if (error && /mode|source|presence_seconds/i.test(error.message ?? "")) {
    await supabase.from("attendance").insert({ ticket_id: ticket.id })
  }
}

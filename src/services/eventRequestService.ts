import { supabase } from "../lib/supabase"
import { getSessionToken } from "../lib/session"
import type { Attachment, EventRequest, EventRequestStatus, EventType } from "../types"

function mapRequest(row: Record<string, any>): EventRequestWithRequester {
  return {
    id: row.id,
    requesterId: row.requester_id,
    title: row.title,
    description: row.description ?? "",
    categoryId: row.category_id ?? undefined,
    eventType: row.event_type ?? "in_person",
    method: row.method ?? "",
    targetAudience: row.target_audience ?? "",
    expectedAttendees: row.expected_attendees ?? undefined,
    trainerName: row.trainer_name ?? "",
    trainerBio: row.trainer_bio ?? "",
    trainerContact: row.trainer_contact ?? "",
    preferredStart: row.preferred_start ?? undefined,
    preferredEnd: row.preferred_end ?? undefined,
    venueId: row.venue_id ?? undefined,
    estimatedBudget: row.estimated_budget != null ? Number(row.estimated_budget) : undefined,
    currencyCode: row.currency_code ?? "USD",
    attachments: Array.isArray(row.attachments) ? (row.attachments as Attachment[]) : [],
    status: row.status,
    adminNotes: row.admin_notes ?? "",
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    createdEventId: row.created_event_id ?? undefined,
    createdAt: row.created_at,
    requesterName: row.requester_name ?? undefined,
    requesterEmail: row.requester_email ?? undefined,
  }
}

/**
 * Event requests are exposed only through session-validated SECURITY DEFINER
 * RPCs. The table itself has no Data API grants for the publishable key.
 */
async function callRpc<T>(name: string, params: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw error
  const result = data as { ok?: boolean; error?: string } | null
  if (!result || result.ok !== true) throw new Error(result?.error ?? fallback)
  return result as T
}

export interface EventRequestInput {
  title: string
  description: string
  categoryId?: string
  eventType: EventType
  method?: string
  targetAudience?: string
  expectedAttendees?: number
  trainerName?: string
  trainerBio?: string
  trainerContact?: string
  preferredStart?: string
  preferredEnd?: string
  venueId?: string
  estimatedBudget?: number
  currencyCode?: string
  attachments?: Attachment[]
}

export interface EventRequestWithRequester extends EventRequest {
  requesterName?: string
  requesterEmail?: string
}

export async function getEventRequests(
  filter?: { status?: EventRequestStatus; requesterId?: string },
): Promise<EventRequestWithRequester[]> {
  const result = await callRpc<{ requests: Record<string, any>[] }>(
    "event_requests_list",
    {
      p_session_token: getSessionToken(),
      p_status: filter?.status ?? null,
      p_requester_id: filter?.requesterId ?? null,
    },
    "Failed to load event requests",
  )
  return (result.requests ?? []).map(mapRequest)
}

export async function createEventRequest(input: EventRequestInput): Promise<EventRequest> {
  if (!input.title.trim()) throw new Error("Event title is required")
  if (!input.description.trim()) throw new Error("Please describe the event")
  if (input.preferredStart && input.preferredEnd && new Date(input.preferredEnd) <= new Date(input.preferredStart)) {
    throw new Error("The preferred end date must be after the start date")
  }

  const result = await callRpc<{ request: Record<string, any> }>(
    "event_requests_create",
    {
      p_session_token: getSessionToken(),
      p_payload: {
        title: input.title.trim(),
        description: input.description.trim(),
        category_id: input.categoryId || null,
        event_type: input.eventType,
        method: input.method ?? "",
        target_audience: input.targetAudience ?? "",
        expected_attendees: input.expectedAttendees ?? null,
        trainer_name: input.trainerName ?? "",
        trainer_bio: input.trainerBio ?? "",
        trainer_contact: input.trainerContact ?? "",
        preferred_start: input.preferredStart || null,
        preferred_end: input.preferredEnd || null,
        venue_id: input.venueId || null,
        estimated_budget: input.estimatedBudget ?? null,
        currency_code: input.currencyCode || "USD",
        attachments: input.attachments ?? [],
      },
    },
    "Failed to submit the request",
  )
  return mapRequest(result.request)
}

/** The requester may refine budget and attachments while the request is open. */
export async function updateEventRequest(
  id: string,
  patch: Partial<Pick<EventRequestInput, "estimatedBudget" | "currencyCode" | "attachments" | "preferredStart" | "preferredEnd" | "description">>,
): Promise<EventRequest> {
  const payload: Record<string, unknown> = {}
  if (patch.estimatedBudget !== undefined) payload.estimated_budget = patch.estimatedBudget
  if (patch.currencyCode !== undefined) payload.currency_code = patch.currencyCode
  if (patch.attachments !== undefined) payload.attachments = patch.attachments
  if (patch.preferredStart !== undefined) payload.preferred_start = patch.preferredStart || null
  if (patch.preferredEnd !== undefined) payload.preferred_end = patch.preferredEnd || null
  if (patch.description !== undefined) payload.description = patch.description
  if (Object.keys(payload).length === 0) throw new Error("Nothing to update")

  const result = await callRpc<{ request: Record<string, any> }>(
    "event_requests_update",
    { p_request_id: id, p_session_token: getSessionToken(), p_payload: payload },
    "Failed to update the request",
  )
  return mapRequest(result.request)
}

export async function setEventRequestStatus(
  id: string,
  status: EventRequestStatus,
  adminNotes?: string,
): Promise<EventRequest> {
  const result = await callRpc<{ request: Record<string, any> }>(
    "event_requests_set_status",
    {
      p_request_id: id,
      p_status: status,
      p_session_token: getSessionToken(),
      p_admin_notes: adminNotes ?? null,
    },
    "Failed to update the request",
  )
  return mapRequest(result.request)
}

export interface ApprovalEventData {
  organizerId: string
  categoryId: string
  venueId?: string
  eventType: EventType
  capacity: number
  onlineCapacity?: number
  inPersonCapacity?: number
  startDate: string
  endDate: string
  registrationDeadline: string
  contactEmail: string
  description?: string
  /** The administrator may confirm or adjust the budget while approving. */
  estimatedBudget?: number
  currencyCode?: string
}

/**
 * Approves a request and creates its draft event in a single database
 * transaction, so a failed update can never leave an orphan event behind.
 */
export async function approveEventRequest(
  requestId: string,
  eventData: ApprovalEventData,
  adminNotes?: string,
): Promise<{ request: EventRequest; eventId: string }> {
  const result = await callRpc<{ request: Record<string, any>; event_id: string }>(
    "event_requests_approve",
    {
      p_request_id: requestId,
      p_session_token: getSessionToken(),
      p_payload: {
        organizer_id: eventData.organizerId,
        category_id: eventData.categoryId,
        venue_id: eventData.venueId || null,
        event_type: eventData.eventType,
        capacity: eventData.capacity,
        online_capacity: eventData.onlineCapacity ?? null,
        in_person_capacity: eventData.inPersonCapacity ?? null,
        start_date: eventData.startDate,
        end_date: eventData.endDate,
        registration_deadline: eventData.registrationDeadline,
        contact_email: eventData.contactEmail,
        description: eventData.description ?? "",
        estimated_budget: eventData.estimatedBudget ?? null,
        currency_code: eventData.currencyCode || "USD",
      },
      p_admin_notes: adminNotes ?? null,
    },
    "Failed to approve the request",
  )
  return { request: mapRequest(result.request), eventId: result.event_id }
}

export async function deleteEventRequest(id: string): Promise<void> {
  await callRpc(
    "event_requests_delete",
    { p_request_id: id, p_session_token: getSessionToken() },
    "Failed to delete the request",
  )
}

import { runtimeFormatDateTime as formatDateTime } from "../i18n/runtimeLocale"
import { supabase } from "../lib/supabase"
import { getSessionToken } from "../lib/session"
import { sendNotification } from "./notificationService"
import type { BanRevokeRequest, BanScope, BanStatus, UserBan } from "../types"

function mapBan(row: Record<string, any>): BanWithNames {
  return {
    id: row.id,
    userId: row.user_id,
    scope: row.scope,
    eventId: row.event_id ?? undefined,
    categoryId: row.category_id ?? undefined,
    reason: row.reason ?? "",
    isPermanent: row.is_permanent ?? true,
    expiresAt: row.expires_at ?? undefined,
    notifyUser: row.notify_user ?? true,
    status: row.status,
    requestedBy: row.requested_by ?? undefined,
    approvedBy: row.approved_by ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    revokedBy: row.revoked_by ?? undefined,
    revokedAt: row.revoked_at ?? undefined,
    revokeReason: row.revoke_reason ?? undefined,
    createdAt: row.created_at,
    userName: row.user_name ?? undefined,
    userEmail: row.user_email ?? undefined,
    eventTitle: row.event_title ?? undefined,
    categoryName: row.category_name ?? undefined,
  }
}

function mapRevokeRequest(row: Record<string, any>): BanRevokeRequest {
  return {
    id: row.id,
    banId: row.ban_id,
    requestedBy: row.requested_by ?? undefined,
    reason: row.reason ?? "",
    status: row.status,
    handledBy: row.handled_by ?? undefined,
    handledAt: row.handled_at ?? undefined,
    createdAt: row.created_at,
  }
}

/**
 * Ban records are exposed only through session-validated SECURITY DEFINER
 * RPCs. The tables themselves have no Data API grants for the publishable key.
 */
async function callRpc<T>(name: string, params: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw error
  const result = data as { ok?: boolean; error?: string } | null
  if (!result || result.ok !== true) throw new Error(result?.error ?? fallback)
  return result as T
}

export interface BanInput {
  userId: string
  scope: BanScope
  eventId?: string
  categoryId?: string
  reason: string
  isPermanent?: boolean
  expiresAt?: string
  notifyUser?: boolean
}

export interface BanWithNames extends UserBan {
  userName?: string
  userEmail?: string
  eventTitle?: string
  categoryName?: string
}

export interface BanUserOption {
  id: string
  email: string
  name: string
}

export interface BanPageData {
  bans: BanWithNames[]
  revokeRequests: BanRevokeRequest[]
  users: BanUserOption[]
  events: Array<{ id: string; title: string }>
  categories: Array<{ id: string; name: string }>
}

/** One RPC returns everything the Bans page needs for the current role. */
export async function getBansPage(): Promise<BanPageData> {
  const result = await callRpc<{
    bans: Record<string, any>[]
    revoke_requests: Record<string, any>[]
    users: Record<string, any>[]
    events: Record<string, any>[]
    categories: Record<string, any>[]
  }>(
    "bans_page_data",
    { p_session_token: getSessionToken() },
    "Failed to load bans",
  )

  return {
    bans: (result.bans ?? []).map(mapBan),
    revokeRequests: (result.revoke_requests ?? []).map(mapRevokeRequest),
    users: (result.users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? "",
      name: u.name ?? u.email ?? "",
    })),
    events: (result.events ?? []).map((e) => ({ id: e.id, title: e.title ?? "" })),
    categories: (result.categories ?? []).map((c) => ({ id: c.id, name: c.name ?? "" })),
  }
}

export async function getBans(filter?: { status?: BanStatus; userId?: string; scope?: BanScope }): Promise<BanWithNames[]> {
  const page = await getBansPage()
  return page.bans.filter(
    (ban) =>
      (!filter?.status || ban.status === filter.status) &&
      (!filter?.userId || ban.userId === filter.userId) &&
      (!filter?.scope || ban.scope === filter.scope),
  )
}

export async function getBanById(id: string): Promise<UserBan | undefined> {
  const bans = await getBans()
  return bans.find((ban) => ban.id === id)
}

export async function getBansForUser(userId: string): Promise<UserBan[]> {
  return getBans({ userId })
}

/** Only active, non-expired bans block a new registration. */
export async function checkBanForRegistration(
  _userId: string,
  eventId: string,
  categoryId?: string,
): Promise<UserBan | null> {
  // The database derives the target user from the session token; the userId
  // argument is kept for call-site compatibility only.
  const result = await callRpc<{ ban: Record<string, any> | null }>(
    "bans_check_registration",
    {
      p_session_token: getSessionToken(),
      p_event_id: eventId,
      p_category_id: categoryId ?? null,
    },
    "Failed to check registration restrictions",
  )
  return result.ban ? mapBan(result.ban) : null
}

export function describeBan(ban: UserBan): string {
  if (ban.scope === "global") return "a global ban"
  if (ban.scope === "event") return "a ban for this event"
  return "a ban in this event category"
}

function banNotice(ban: UserBan): string {
  const expiry = ban.isPermanent
    ? "This ban is permanent."
    : ban.expiresAt
      ? `It ends on ${formatDateTime(ban.expiresAt)}.`
      : ""
  return `You have been restricted by ${describeBan(ban)}. ${ban.reason ? `Reason: ${ban.reason}. ` : ""}${expiry} You can still use your account but cannot register for new events covered by this ban.`
}

function liftNotice(reason?: string): string {
  return `The restriction on your account has been lifted.${reason ? ` Note: ${reason}` : ""}`
}

/**
 * Creates a ban. Administrators create active bans immediately; organizer
 * requests are stored as pending until an administrator approves them.
 */
export async function createBan(input: BanInput): Promise<UserBan> {
  if (input.scope !== "global" && input.scope !== "event" && input.scope !== "category") {
    throw new Error("Invalid ban scope")
  }
  if (input.scope === "event" && !input.eventId) throw new Error("Choose the event for this ban")
  if (input.scope === "category" && !input.categoryId) throw new Error("Choose the category for this ban")
  if (!input.reason.trim()) throw new Error("A reason is required")

  const result = await callRpc<{ ban: Record<string, any> }>(
    "bans_create",
    {
      p_session_token: getSessionToken(),
      p_payload: {
        user_id: input.userId,
        scope: input.scope,
        event_id: input.scope === "event" ? input.eventId : null,
        category_id: input.scope === "category" ? input.categoryId : null,
        reason: input.reason.trim(),
        is_permanent: input.isPermanent ?? true,
        expires_at: input.isPermanent === false ? input.expiresAt || null : null,
        notify_user: input.notifyUser ?? true,
      },
    },
    "Failed to save the ban",
  )
  const ban = mapBan(result.ban)

  if (ban.status === "active" && ban.notifyUser) {
    await sendNotification(ban.userId, "ban_notice", banNotice(ban), "/dashboard/notifications").catch(() => undefined)
  }

  return ban
}

export async function approveBan(id: string): Promise<UserBan> {
  const result = await callRpc<{ ban: Record<string, any> }>(
    "bans_decide",
    { p_ban_id: id, p_decision: "approve", p_session_token: getSessionToken() },
    "Failed to approve",
  )
  const ban = mapBan(result.ban)
  if (ban.notifyUser) {
    await sendNotification(ban.userId, "ban_notice", banNotice(ban), "/dashboard/notifications").catch(() => undefined)
  }
  return ban
}

export async function rejectBan(id: string): Promise<UserBan> {
  const result = await callRpc<{ ban: Record<string, any> }>(
    "bans_decide",
    { p_ban_id: id, p_decision: "reject", p_session_token: getSessionToken() },
    "Failed to reject",
  )
  return mapBan(result.ban)
}

export async function revokeBan(id: string, reason: string): Promise<UserBan> {
  const result = await callRpc<{ ban: Record<string, any> }>(
    "bans_revoke",
    { p_ban_id: id, p_reason: reason, p_session_token: getSessionToken() },
    "Failed to lift the ban",
  )
  const ban = mapBan(result.ban)

  await sendNotification(
    ban.userId,
    "ban_approved",
    liftNotice(reason || ban.revokeReason),
    "/dashboard/notifications",
  ).catch(() => undefined)

  return ban
}

export async function requestBanRevoke(banId: string, reason: string): Promise<BanRevokeRequest> {
  if (!reason.trim()) throw new Error("Please explain why the ban should be lifted")
  const result = await callRpc<{ request: Record<string, any> }>(
    "bans_request_revoke",
    { p_ban_id: banId, p_reason: reason.trim(), p_session_token: getSessionToken() },
    "Failed to send the request",
  )
  return mapRevokeRequest(result.request)
}

export async function getBanRevokeRequests(status?: "pending" | "approved" | "rejected"): Promise<BanRevokeRequest[]> {
  const page = await getBansPage()
  return page.revokeRequests.filter((request) => !status || request.status === status)
}

export async function approveBanRevoke(requestId: string): Promise<void> {
  const result = await callRpc<{ request: Record<string, any>; ban: Record<string, any> | null }>(
    "bans_decide_revoke",
    { p_request_id: requestId, p_decision: "approve", p_session_token: getSessionToken() },
    "Failed to handle the request",
  )
  if (!result.ban) return
  const ban = mapBan(result.ban)
  if (ban.notifyUser) {
    await sendNotification(
      ban.userId,
      "ban_approved",
      liftNotice(result.request?.reason || ban.revokeReason),
      "/dashboard/notifications",
    ).catch(() => undefined)
  }
}

export async function rejectBanRevoke(requestId: string): Promise<void> {
  await callRpc(
    "bans_decide_revoke",
    { p_request_id: requestId, p_decision: "reject", p_session_token: getSessionToken() },
    "Failed to handle the request",
  )
}

export interface UserRegistrationSummary {
  id: string
  eventId: string
  eventTitle: string
  status: string
  registeredAt: string
}

/** Used by administrators before confirming a ban: shows the user's existing registrations. */
export async function getUserRegistrationSummary(userId: string): Promise<UserRegistrationSummary[]> {
  const result = await callRpc<{ registrations: Record<string, any>[] }>(
    "bans_registration_summary",
    { p_session_token: getSessionToken(), p_user_id: userId },
    "Failed to load registrations",
  )
  return (result.registrations ?? []).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    eventTitle: row.event_title ?? "Unknown event",
    status: row.status,
    registeredAt: row.registered_at,
  }))
}

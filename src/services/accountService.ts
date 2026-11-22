import { runtimeFormatDateTime as formatDateTime } from "../i18n/runtimeLocale"
import { supabase } from "../lib/supabase"
import { getSessionToken } from "../lib/session"
import { isMissingFunction } from "../lib/supabaseErrors"
import { markDeletedAccount } from "./audienceService"
import { sendNotification } from "./notificationService"
import { getAdminUserIds } from "./userService"
import { DEFAULT_ACCOUNT_DELETION_GRACE_DAYS } from "../constants"

const UNAVAILABLE = "This feature needs the database upgrade. Run supabase/migrations/2026-11-06_all_additions.sql first."

function parseRpc<T>(data: unknown, error: unknown, fallback: string): T {
  if (isMissingFunction(error)) throw new Error(UNAVAILABLE)
  if (error) throw new Error((error as { message?: string }).message ?? fallback)
  if (!data) throw new Error(fallback)
  const payload = data as { error?: string } & Record<string, unknown>
  if (payload.error) throw new Error(payload.error)
  return data as T
}

export interface DeletionOptions {
  userId: string
  profileId?: string
  email: string
  reason?: string
  graceDays?: number
  deletedByEmail?: string
  actorUserId?: string
}

/**
 * Transfers every event primarily owned by the user to an administrator.
 * Co-organizer assignments are also moved so the event keeps a manager.
 */
async function transferOrganizerEvents(profileId: string, adminProfileId: string, adminUserId: string): Promise<number> {
  const { data: ownEvents } = await supabase
    .from("events")
    .select("id")
    .eq("organizer_id", profileId)
    .is("deleted_at", null)
  const eventIds = (ownEvents ?? []).map((e) => e.id)
  if (eventIds.length === 0) return 0

  const { error } = await supabase.from("events").update({ organizer_id: adminProfileId }).in("id", eventIds)
  if (error) throw error

  // Add the administrator as a co-organizer as well (ignore duplicates).
  await Promise.all(
    eventIds.map((eventId) =>
      supabase
        .from("event_organizers")
        .insert({ event_id: eventId, user_id: adminUserId, is_primary: true })
        .then(() => undefined, () => undefined),
    ),
  )
  return eventIds.length
}

/**
 * Immediately disables the account, keeps all data for the recovery window and
 * flags the email in the audience database. Organizer-owned events are handed
 * over to an administrator first.
 */
export async function requestAccountDeletion(options: DeletionOptions): Promise<{ restoreUntil?: string; transferredEvents: number }> {
  const graceDays = options.graceDays ?? DEFAULT_ACCOUNT_DELETION_GRACE_DAYS
  const admins = await getAdminUserIds().catch(() => [])
  const admin = admins[0]

  let transferredEvents = 0
  if (options.profileId && admin?.profileId) {
    transferredEvents = await transferOrganizerEvents(options.profileId, admin.profileId, admin.userId)
  }

  const { data, error } = await supabase.rpc("request_account_deletion", {
    p_user_id: options.userId,
    p_reason: options.reason ?? "",
    p_session_token: getSessionToken(),
    p_grace_days: graceDays,
  })
  const result = parseRpc<{ ok: boolean; restore_until?: string }>(data, error, "Failed to delete the account")

  await markDeletedAccount(options.email, options.deletedByEmail ?? options.email)
  await supabase.from("device_sessions").delete().eq("user_id", options.userId)

  if (admin) {
    await sendNotification(
      admin.userId,
      "account_deletion",
      `Account ${options.email} was deleted. ${transferredEvents} event(s) were transferred. It can be restored until ${result.restore_until ? formatDateTime(result.restore_until) : "the recovery window ends"}.`,
      "/dashboard/admin/users",
    ).catch(() => undefined)
  }

  return { restoreUntil: result.restore_until, transferredEvents }
}

/** Owner-initiated recovery from the login screen (requires the password). */
export async function restoreAccount(email: string, password: string): Promise<void> {
  const { data, error } = await supabase.rpc("restore_account", {
    p_email: email.trim().toLowerCase(),
    p_password: password,
  })
  parseRpc<{ ok: boolean }>(data, error, "Failed to restore the account")
}

/** Administrator restores a deleted account, regardless of the remaining window. */
export async function adminRestoreAccount(userId: string): Promise<void> {
  const { data, error } = await supabase.rpc("admin_restore_account", {
    p_user_id: userId,
    p_session_token: getSessionToken(),
  })
  parseRpc<{ ok: boolean }>(data, error, "Failed to restore the account")

  await sendNotification(
    userId,
    "account_restored",
    "Your account was restored by an administrator. You can sign in again.",
    "/login",
  ).catch(() => undefined)
}

export async function getAccountDeletionInfo(userId: string): Promise<{
  deletedAt?: string
  scheduledDeletionAt?: string
  deletionReason?: string
} | null> {
  const { data, error } = await supabase
    .from("users")
    .select("deleted_at, scheduled_deletion_at, deletion_reason")
    .eq("id", userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    deletedAt: data.deleted_at ?? undefined,
    scheduledDeletionAt: data.scheduled_deletion_at ?? undefined,
    deletionReason: data.deletion_reason ?? undefined,
  }
}

export interface AnonymizedAccountReport {
  eventCount: number
  registrationCount: number
  confirmedCount: number
  attendedCount: number
  feedbackCount: number
  chatMessageCount: number
  generatedAt: string
}

/**
 * Produces an aggregate report that contains no name, email or phone number,
 * so a leaving user's activity can still be reported without identifying them.
 */
export async function getAnonymizedAccountReport(profileId: string, userId: string): Promise<AnonymizedAccountReport> {
  const [events, registrations, attendance, feedback, messages] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }).eq("organizer_id", profileId),
    supabase.from("registrations").select("id, status", { count: "exact" }).eq("attendee_id", profileId),
    supabase.from("attendance").select("id", { count: "exact", head: true }),
    supabase.from("feedback").select("id", { count: "exact", head: true }).eq("attendee_id", profileId),
    supabase.from("chat_messages").select("id", { count: "exact", head: true }).eq("sender_id", userId),
  ])

  const regs = registrations.data ?? []
  return {
    eventCount: events.count ?? 0,
    registrationCount: regs.length,
    confirmedCount: regs.filter((r: any) => r.status === "confirmed").length,
    attendedCount: attendance.count ?? 0,
    feedbackCount: feedback.count ?? 0,
    chatMessageCount: messages.count ?? 0,
    generatedAt: new Date().toISOString(),
  }
}

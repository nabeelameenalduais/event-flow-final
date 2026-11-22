import { supabase } from "../lib/supabase"
import { isMissingRelation } from "../lib/supabaseErrors"
import { sendEmail } from "./emailService"
import type {
  AdminMessage,
  AdminMessageChannel,
  AdminMessageRecipient,
  AdminMessageTarget,
  CampaignStatus,
  RecipientStatusFilter,
} from "../types"

export interface AdminMessageInput {
  title: string
  body: string
  link?: string
  channel: AdminMessageChannel
  targetType: AdminMessageTarget
  eventId?: string
  userIds?: string[]
  recipientStatus?: RecipientStatusFilter
  scheduledAt?: string
  sendNow?: boolean
}

export interface MessageRecipient {
  userId: string
  email: string
  name: string
}

function mapMessage(row: Record<string, any>): AdminMessage {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    link: row.link ?? undefined,
    channel: row.channel,
    targetType: row.target_type,
    eventId: row.event_id ?? undefined,
    userIds: Array.isArray(row.user_ids) ? row.user_ids : [],
    recipientStatus: row.recipient_status ?? "both",
    scheduledAt: row.scheduled_at ?? undefined,
    status: row.status,
    totalRecipients: Number(row.total_recipients ?? 0),
    sentCount: Number(row.sent_count ?? 0),
    failedCount: Number(row.failed_count ?? 0),
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    sentAt: row.sent_at ?? undefined,
  }
}

function mapRecipient(row: Record<string, any>): AdminMessageRecipient {
  return {
    id: row.id,
    messageId: row.message_id,
    userId: row.user_id ?? undefined,
    email: row.email ?? undefined,
    inAppSent: row.in_app_sent ?? false,
    notificationId: row.notification_id ?? undefined,
    emailStatus: row.email_status ?? "skipped",
    error: row.error ?? undefined,
    readAt: row.read_at ?? undefined,
  }
}

export async function getAdminMessages(): Promise<AdminMessage[]> {
  const { data, error } = await supabase
    .from("admin_messages")
    .select("*")
    .order("created_at", { ascending: false })
  if (error && isMissingRelation(error)) return []
  if (error) throw error
  return (data ?? []).map(mapMessage)
}

export async function getAdminMessageRecipients(messageId: string): Promise<AdminMessageRecipient[]> {
  const { data, error } = await supabase
    .from("admin_message_recipients")
    .select("*")
    .eq("message_id", messageId)
    .order("email")
  if (error && isMissingRelation(error)) return []
  if (error) throw error
  return (data ?? []).map(mapRecipient)
}

export async function resolveMessageRecipients(input: {
  targetType: AdminMessageTarget
  eventId?: string
  userIds?: string[]
  recipientStatus?: RecipientStatusFilter
}): Promise<MessageRecipient[]> {
  if (input.targetType === "users") {
    const ids = [...new Set(input.userIds ?? [])]
    if (ids.length === 0) return []
    const { data } = await supabase
      .from("users")
      .select("id, email, deleted_at, profile:profiles(first_name, last_name)")
      .in("id", ids)
    return (data ?? [])
      .filter((u: any) => u.email && !u.deleted_at)
      .map((u: any) => ({
        userId: u.id,
        email: u.email,
        name: `${u.profile?.first_name ?? ""} ${u.profile?.last_name ?? ""}`.trim() || u.email,
      }))
  }

  if (input.targetType === "event") {
    if (!input.eventId) return []
    const statusFilter = input.recipientStatus ?? "both"
    const statuses =
      statusFilter === "confirmed" ? ["confirmed"] : statusFilter === "waitlisted" ? ["waitlisted"] : ["confirmed", "waitlisted"]
    const { data: regs } = await supabase
      .from("registrations")
      .select("attendee_id")
      .eq("event_id", input.eventId)
      .in("status", statuses)
    const attendeeIds = [...new Set((regs ?? []).map((r: any) => r.attendee_id))]
    if (attendeeIds.length === 0) return []
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, user:users(email, deleted_at)")
      .in("id", attendeeIds)
    return (profiles ?? [])
      .filter((p: any) => p.user?.email && !p.user?.deleted_at)
      .map((p: any) => ({
        userId: p.user_id,
        email: p.user.email,
        name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.user.email,
      }))
  }

  // all active users
  const { data } = await supabase
    .from("users")
    .select("id, email, suspended, deleted_at, profile:profiles(first_name, last_name)")
    .is("deleted_at", null)
  return (data ?? [])
    .filter((u: any) => u.email && !u.suspended && !u.deleted_at)
    .map((u: any) => ({
      userId: u.id,
      email: u.email,
      name: `${u.profile?.first_name ?? ""} ${u.profile?.last_name ?? ""}`.trim() || u.email,
    }))
}

export async function createAdminMessage(input: AdminMessageInput, createdBy: string): Promise<AdminMessage> {
  const recipients = await resolveMessageRecipients(input)
  const status: CampaignStatus = input.sendNow ? "draft" : input.scheduledAt ? "scheduled" : "draft"

  const { data, error } = await supabase
    .from("admin_messages")
    .insert({
      title: input.title,
      body: input.body,
      link: input.link || null,
      channel: input.channel,
      target_type: input.targetType,
      event_id: input.eventId || null,
      user_ids: input.userIds ?? [],
      recipient_status: input.recipientStatus ?? "both",
      scheduled_at: input.scheduledAt || null,
      status,
      total_recipients: recipients.length,
      created_by: createdBy,
    })
    .select()
    .single()
  if (error) throw error

  if (recipients.length > 0) {
    const { error: recipientsError } = await supabase.from("admin_message_recipients").insert(
      recipients.map((r) => ({
        message_id: data.id,
        user_id: r.userId,
        email: r.email,
        email_status: "skipped",
      })),
    )
    if (recipientsError) throw recipientsError
  }

  const message = mapMessage(data)
  if (input.sendNow) return (await sendAdminMessage(message.id)) ?? message
  return message
}

export async function sendAdminMessage(messageId: string): Promise<AdminMessage | undefined> {
  const { data: messageRow, error: messageError } = await supabase
    .from("admin_messages")
    .select("*")
    .eq("id", messageId)
    .single()
  if (messageError) throw messageError
  if (!messageRow) return undefined
  const message = mapMessage(messageRow)
  if (message.status === "sent" || message.status === "cancelled") return message

  await supabase.from("admin_messages").update({ status: "sending" }).eq("id", messageId)

  const { data: recipients } = await supabase
    .from("admin_message_recipients")
    .select("*")
    .eq("message_id", messageId)

  let sent = 0
  let failed = 0
  for (const recipient of recipients ?? []) {
    let inAppOk = false
    let emailOk = true
    let errorMessage: string | null = null
    let notificationId: string | null = null

    if (message.channel === "in_app" || message.channel === "both") {
      if (!recipient.user_id) {
        inAppOk = false
      } else {
        const { data: notification, error: notificationError } = await supabase
          .from("notifications")
          .insert({
            user_id: recipient.user_id,
            type: "admin_message",
            message: `${message.title}: ${message.body}`,
            link: message.link ?? null,
          })
          .select()
          .single()
        if (notificationError) {
          errorMessage = notificationError.message
        } else {
          inAppOk = true
          notificationId = notification?.id ?? null
        }
      }
    } else {
      inAppOk = true
    }

    if (message.channel === "email" || message.channel === "both") {
      if (!recipient.email) {
        emailOk = false
        errorMessage = errorMessage ?? "Missing email address"
      } else {
        const result = await sendEmail({
          to: recipient.email,
          subject: message.title,
          body: `<h2>${escapeHtml(message.title)}</h2><p>${escapeHtml(message.body).replace(/\n/g, "<br/>")}</p>${
            message.link ? `<p><a href="${escapeHtml(message.link)}">Open EventFlow</a></p>` : ""
          }`,
        })
        emailOk = result.ok
        if (!result.ok) errorMessage = result.error ?? "Email delivery failed"
      }
    }

    const delivered = inAppOk || (emailOk && (message.channel === "email" || message.channel === "both"))
    if (delivered) sent += 1
    else failed += 1

    await supabase
      .from("admin_message_recipients")
      .update({
        in_app_sent: inAppOk,
        notification_id: notificationId,
        email_status: message.channel === "in_app" ? "skipped" : emailOk ? "sent" : "failed",
        error: errorMessage,
      })
      .eq("id", recipient.id)
  }

  const status: CampaignStatus = sent === 0 && failed > 0 ? "failed" : "sent"
  const { data: updated } = await supabase
    .from("admin_messages")
    .update({
      status,
      sent_count: message.sentCount + sent,
      failed_count: message.failedCount + failed,
      sent_at: new Date().toISOString(),
    })
    .eq("id", messageId)
    .select()
    .single()
  return updated ? mapMessage(updated) : undefined
}

export async function processDueAdminMessages(): Promise<number> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("admin_messages")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
  if (error && isMissingRelation(error)) return 0
  if (error) throw error
  let count = 0
  for (const row of data ?? []) {
    await sendAdminMessage(row.id)
    count += 1
  }
  return count
}

export async function cancelAdminMessage(id: string): Promise<void> {
  const { error } = await supabase.from("admin_messages").update({ status: "cancelled" }).eq("id", id)
  if (error) throw error
}

export async function deleteAdminMessage(id: string): Promise<void> {
  const { error } = await supabase.from("admin_messages").delete().eq("id", id)
  if (error) throw error
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

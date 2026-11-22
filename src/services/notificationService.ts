import { runtimeFormatDate as formatDate } from "../i18n/runtimeLocale"
import { supabase } from "../lib/supabase"
import type { Notification, NotificationType } from "../types"

function mapNotification(n: Record<string, any>): Notification {
  return {
    id: n.id,
    userId: n.user_id,
    type: n.type,
    message: n.message,
    readAt: n.read_at ?? null,
    createdAt: n.created_at,
    link: n.link ?? undefined,
  }
}

export async function getNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapNotification)
}

export async function markAsRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}

export async function markAllAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null)
  if (error) throw error
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id)
  if (error) throw error
}

export async function sendNotification(
  userId: string,
  type: NotificationType,
  message: string,
  link?: string,
): Promise<Notification> {
  const { data, error } = await supabase
    .from("notifications")
    .insert({ user_id: userId, type, message, link })
    .select()
    .single()
  if (error) throw error
  return mapNotification(data)
}

export async function sendEventReminder(eventId: string): Promise<number> {
  const { data: event } = await supabase
    .from("events")
    .select("title, start_date")
    .eq("id", eventId)
    .single()
  if (!event) throw new Error("Event not found")

  const { data: regs } = await supabase
    .from("registrations")
    .select("attendee_id")
    .eq("event_id", eventId)
    .eq("status", "confirmed")

  if (!regs || regs.length === 0) return 0

  const { data: profs } = await supabase
    .from("profiles")
    .select("user_id")
    .in("id", regs.map((r) => r.attendee_id))

  if (!profs) return 0

  const notifications = profs.map((p) => ({
    user_id: p.user_id,
    type: "event_reminder" as NotificationType,
    message: `Reminder: "${event.title}" starts ${formatDate(event.start_date)}!`,
    link: `/events/${eventId}`,
  }))

  const { error } = await supabase.from("notifications").insert(notifications)
  if (error) throw error
  return notifications.length
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null)
  if (error) throw error
  return count ?? 0
}

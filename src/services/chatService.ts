import { supabase } from "../lib/supabase"
import { runtimeT } from "../i18n/runtimeLocale"
import type { ChatChannel, ChatMessage, ChatMessageWithSender } from "../types"

export interface ChatChannelInfo extends ChatChannel {
  title: string
  subtitle: string
}

function mapChannel(c: Record<string, any>): ChatChannel {
  return {
    id: c.id,
    eventId: c.event_id,
    channelType: c.channel_type,
    organizerId: c.organizer_id ?? null,
    attendeeId: c.attendee_id ?? null,
    createdAt: c.created_at,
  }
}

function mapMessage(m: Record<string, any>): ChatMessage {
  return {
    id: m.id,
    channelId: m.channel_id,
    senderId: m.sender_id,
    content: m.content,
    createdAt: m.created_at,
  }
}

async function getProfileName(userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("user_id", userId)
    .maybeSingle()
  if (data) return `${data.first_name} ${data.last_name}`.trim() || "User"
  const { data: u } = await supabase.from("users").select("email").eq("id", userId).maybeSingle()
  return u?.email ?? "User"
}

/**
 * Ensures the general channel exists for an event.
 */
export async function ensureGeneralChannel(eventId: string): Promise<ChatChannel> {
  const { data: general } = await supabase
    .from("chat_channels")
    .select("*")
    .eq("event_id", eventId)
    .eq("channel_type", "general")
    .maybeSingle()
  if (general) return mapChannel(general)

  const { data, error } = await supabase
    .from("chat_channels")
    .insert({ event_id: eventId, channel_type: "general", organizer_id: null, attendee_id: null })
    .select()
    .single()
  if (error) throw error
  return mapChannel(data)
}

/**
 * Get or create the 1:1 private channel between an attendee (profile id) and an organizer (user id).
 */
export async function ensurePrivateChannel(
  eventId: string,
  organizerUserId: string,
  attendeeProfileId: string,
): Promise<ChatChannel> {
  const { data: existing } = await supabase
    .from("chat_channels")
    .select("*")
    .eq("event_id", eventId)
    .eq("channel_type", "private")
    .eq("organizer_id", organizerUserId)
    .eq("attendee_id", attendeeProfileId)
    .maybeSingle()
  if (existing) return mapChannel(existing)

  const { data, error } = await supabase
    .from("chat_channels")
    .insert({
      event_id: eventId,
      channel_type: "private",
      organizer_id: organizerUserId,
      attendee_id: attendeeProfileId,
    })
    .select()
    .single()
  if (error) throw error
  return mapChannel(data)
}

/**
 * User ids of the event's primary organizer plus any assigned co-organizers.
 * `events.organizer_id` references `profiles.id`, whereas `event_organizers`
 * and `chat_channels` use `users.id`, so the primary organizer is resolved.
 */
async function getOrganizerUserIdsForEvent(eventId: string): Promise<string[]> {
  const ids = new Set<string>()

  const { data: event } = await supabase
    .from("events")
    .select("organizer_id")
    .eq("id", eventId)
    .single()

  if (event?.organizer_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("id", event.organizer_id)
      .maybeSingle()
    if (profile?.user_id) ids.add(profile.user_id)
  }

  const { data: orgs } = await supabase
    .from("event_organizers")
    .select("user_id")
    .eq("event_id", eventId)
  for (const org of orgs ?? []) {
    if (org.user_id) ids.add(org.user_id)
  }

  return [...ids]
}

/**
 * Channels accessible to a user for an event, enriched with titles.
 */
export async function getChannelsForUser(eventId: string, userId: string, attendeeProfileId?: string): Promise<ChatChannelInfo[]> {
  const { data: userRole } = await supabase
    .from("profiles")
    .select("role:roles(name)")
    .eq("user_id", userId)
    .maybeSingle()

  const isOrganizerOrAdmin = (userRole as any)?.role?.name === "organizer" || (userRole as any)?.role?.name === "admin"
  const result: ChatChannelInfo[] = []

  // General channel
  const general = await ensureGeneralChannel(eventId)
  const { data: event } = await supabase.from("events").select("title").eq("id", eventId).single()
  result.push({
    ...general,
    title: runtimeT("Community"),
    subtitle: runtimeT('General chat for "{title}"', { title: event?.title ?? "event" }),
  })

  // Private channels
  if (isOrganizerOrAdmin) {
    const { data: privateChannels } = await supabase
      .from("chat_channels")
      .select("*")
      .eq("event_id", eventId)
      .eq("channel_type", "private")
      .eq("organizer_id", userId)
      .order("created_at")
    for (const c of privateChannels ?? []) {
      const attendee = c.attendee_id
        ? await getProfileByProfileId(c.attendee_id)
        : { name: runtimeT("Attendee"), email: "" }
      result.push({
        ...mapChannel(c),
        title: runtimeT("Private · {name}", { name: attendee.name }),
        subtitle: attendee.email || runtimeT("1:1 conversation"),
      })
    }
  } else if (attendeeProfileId) {
    const organizerIds = await getOrganizerUserIdsForEvent(eventId)

    for (const orgId of organizerIds) {
      const channel = await ensurePrivateChannel(eventId, orgId, attendeeProfileId)
      const orgName = await getProfileName(orgId)
      result.push({
        ...channel,
        title: runtimeT("Private · {name}", { name: orgName }),
        subtitle: runtimeT("1:1 conversation with the organizer"),
      })
    }
  }

  return result
}

async function getProfileByProfileId(profileId: string): Promise<{ name: string; email: string }> {
  const { data } = await supabase
    .from("profiles")
    .select("first_name, last_name, user:users(email)")
    .eq("id", profileId)
    .maybeSingle()
  if (!data) return { name: "Attendee", email: "" }
  const userRow = (data as any).user
  return {
    name: `${data.first_name} ${data.last_name}`.trim() || "Attendee",
    email: Array.isArray(userRow) ? userRow[0]?.email ?? "" : userRow?.email ?? "",
  }
}

export async function getChannelById(channelId: string): Promise<ChatChannel | undefined> {
  const { data, error } = await supabase
    .from("chat_channels")
    .select("*")
    .eq("id", channelId)
    .maybeSingle()
  if (error) throw error
  return data ? mapChannel(data) : undefined
}

export async function getMessages(
  channelId: string,
  requester?: { userId: string; attendeeProfileId?: string },
  limit = 100,
): Promise<ChatMessageWithSender[]> {
  const channel = await getChannelById(channelId)
  if (!channel) throw new Error("Channel not found")

  // Private 1:1 channels are only readable by the two parties (NF3).
  if (channel.channelType === "private") {
    const { data: attendee } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("id", channel.attendeeId)
      .maybeSingle()
    const attendeeUserId = (attendee as any)?.user_id
    const isOrganizer = requester?.userId === channel.organizerId
    const isAttendee = requester?.userId === attendeeUserId
    if (!isOrganizer && !isAttendee) {
      throw new Error("You do not have access to this channel")
    }
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*, sender:users(email)")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: true })
    .limit(limit)
  if (error) throw error

  const rows = (data ?? []) as any[]
  const userIds = [...new Set(rows.map((m) => m.sender_id))]
  const profileMap: Record<string, any> = {}

  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, role:roles(name)")
      .in("user_id", userIds)
    for (const p of profs ?? []) profileMap[p.user_id] = p
  }

  return rows.map((m) => {
    const prof = profileMap[m.sender_id]
    const fullName = prof ? `${prof.first_name} ${prof.last_name}`.trim() : (m.sender?.email ?? "Unknown")
    return {
      ...mapMessage(m),
      senderName: fullName,
      senderRole: prof?.role?.name,
    }
  })
}

/**
 * User ids that participate in a channel (for notifications).
 * General: confirmed attendees + organizers + admins.
 * Private: exactly the organizer and the attendee (1:1).
 */
export async function getChannelMemberUserIds(channel: ChatChannel): Promise<string[]> {
  if (channel.channelType === "private") {
    const { data: attendee } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("id", channel.attendeeId)
      .maybeSingle()
    return [channel.organizerId, attendee?.user_id].filter(Boolean) as string[]
  }

  // general channel
  const { data: regs } = await supabase
    .from("registrations")
    .select("attendee_id")
    .eq("event_id", channel.eventId)
    .eq("status", "confirmed")

  const attendeeProfileIds = (regs ?? []).map((r) => r.attendee_id)
  const attendeeUserIds: string[] = []
  if (attendeeProfileIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id")
      .in("id", attendeeProfileIds)
    for (const p of profs ?? []) attendeeUserIds.push(p.user_id)
  }

  const organizerUserIds = await getOrganizerUserIdsForEvent(channel.eventId)

  const { data: adminRoles } = await supabase.from("roles").select("id").eq("name", "admin")
  if (adminRoles && adminRoles.length > 0) {
    const { data: admins } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("role_id", adminRoles[0].id)
    for (const a of admins ?? []) organizerUserIds.push(a.user_id)
  }

  return [...new Set([...attendeeUserIds, ...organizerUserIds])]
}

export async function sendMessage(channelId: string, senderId: string, content: string): Promise<ChatMessage> {
  const trimmed = content.trim()
  if (!trimmed) throw new Error("Message cannot be empty")

  const channel = await getChannelById(channelId)
  if (!channel) throw new Error("Channel not found")

  // Private 1:1 channels are only writable by the two parties (NF3).
  if (channel.channelType === "private") {
    const { data: attendee } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("id", channel.attendeeId)
      .maybeSingle()
    const attendeeUserId = (attendee as any)?.user_id
    if (senderId !== channel.organizerId && senderId !== attendeeUserId) {
      throw new Error("You do not have access to this channel")
    }
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ channel_id: channelId, sender_id: senderId, content: trimmed })
    .select()
    .single()
  if (error) throw error

  notifyChannelMembers(channelId, senderId).catch(() => {})
  return mapMessage(data)
}

async function notifyChannelMembers(channelId: string, senderId: string): Promise<void> {
  const channel = await getChannelById(channelId)
  if (!channel) return
  const members = await getChannelMemberUserIds(channel)
  const recipients = members.filter((id) => id !== senderId)
  if (recipients.length === 0) return

  const { data: event } = await supabase
    .from("events")
    .select("title")
    .eq("id", channel.eventId)
    .single()

  const { data: sender } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("user_id", senderId)
    .single()

  const senderName = sender ? `${sender.first_name} ${sender.last_name}`.trim() : "Someone"
  const label = channel.channelType === "general" ? "the event community" : "a private chat"
  const message = `${senderName} sent a message in ${label} of "${event?.title ?? "event"}".`

  const rows = recipients.map((userId) => ({
    user_id: userId,
    type: "chat_message",
    message,
    link: `/dashboard/events/${channel.eventId}/chat`,
  }))

  await supabase.from("notifications").insert(rows)
}

export function subscribeToChannel(
  channelId: string,
  onMessage: (message: ChatMessage) => void,
  onStatus?: (status: string) => void,
) {
  return supabase
    .channel(`chat-${channelId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${channelId}` },
      (payload) => {
        onMessage(mapMessage(payload.new as Record<string, any>))
      },
    )
    .subscribe((status) => {
      onStatus?.(status)
    })
}

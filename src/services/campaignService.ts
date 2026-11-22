import { supabase } from "../lib/supabase"
import { isMissingRelation } from "../lib/supabaseErrors"
import { sendEmail, getEmailProvider } from "./emailService"
import type {
  AudienceContact,
  CampaignStatus,
  CampaignTargetType,
  EmailCampaign,
  EmailCampaignRecipient,
  RecipientStatusFilter,
} from "../types"

export interface CampaignInput {
  name: string
  subject: string
  body: string
  targetType: CampaignTargetType
  targetEventId?: string
  targetTags?: string[]
  targetContactIds?: string[]
  recipientStatus?: RecipientStatusFilter
  scheduledAt?: string
  sendNow?: boolean
}

export interface ResolvedRecipient {
  email: string
  name: string
  contactId?: string
}

function mapCampaign(row: Record<string, any>): EmailCampaign {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    body: row.body,
    targetType: row.target_type,
    targetEventId: row.target_event_id ?? undefined,
    targetTags: Array.isArray(row.target_tags) ? row.target_tags : [],
    targetContactIds: Array.isArray(row.target_contact_ids) ? row.target_contact_ids : [],
    recipientStatus: row.recipient_status ?? "both",
    scheduledAt: row.scheduled_at ?? undefined,
    status: row.status,
    provider: row.provider ?? "mock",
    totalRecipients: Number(row.total_recipients ?? 0),
    sentCount: Number(row.sent_count ?? 0),
    failedCount: Number(row.failed_count ?? 0),
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    sentAt: row.sent_at ?? undefined,
  }
}

function mapRecipient(row: Record<string, any>): EmailCampaignRecipient {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    contactId: row.contact_id ?? undefined,
    email: row.email,
    status: row.status,
    error: row.error ?? undefined,
    sentAt: row.sent_at ?? undefined,
  }
}

export async function getCampaigns(): Promise<EmailCampaign[]> {
  const { data, error } = await supabase
    .from("email_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
  if (error && isMissingRelation(error)) return []
  if (error) throw error
  return (data ?? []).map(mapCampaign)
}

export async function getCampaignRecipients(campaignId: string): Promise<EmailCampaignRecipient[]> {
  const { data, error } = await supabase
    .from("email_campaign_recipients")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("email")
  if (error && isMissingRelation(error)) return []
  if (error) throw error
  return (data ?? []).map(mapRecipient)
}

async function getSubscribedContacts(): Promise<AudienceContact[]> {
  const { data, error } = await supabase
    .from("audience_contacts")
    .select("*")
    .eq("status", "subscribed")
  if (error && isMissingRelation(error)) return []
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    id: row.id,
    email: row.email,
    name: row.name ?? "",
    phone: row.phone ?? "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    source: row.source ?? "manual",
    status: row.status,
    userId: row.user_id ?? undefined,
    notes: row.notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

function dedupeRecipients(recipients: ResolvedRecipient[]): ResolvedRecipient[] {
  const seen = new Set<string>()
  const result: ResolvedRecipient[] = []
  for (const recipient of recipients) {
    const email = recipient.email.trim().toLowerCase()
    if (!email || seen.has(email)) continue
    seen.add(email)
    result.push({ ...recipient, email })
  }
  return result
}

/** Resolves the current audience for a campaign target. */
export async function resolveCampaignRecipients(input: {
  targetType: CampaignTargetType
  targetEventId?: string
  targetTags?: string[]
  targetContactIds?: string[]
  recipientStatus?: RecipientStatusFilter
}): Promise<ResolvedRecipient[]> {
  const contacts = await getSubscribedContacts()

  if (input.targetType === "all") {
    return dedupeRecipients(contacts.map((c) => ({ email: c.email, name: c.name, contactId: c.id })))
  }

  if (input.targetType === "tag") {
    const tags = (input.targetTags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean)
    return dedupeRecipients(
      contacts
        .filter((c) => tags.length === 0 || c.tags.some((tag) => tags.includes(tag.toLowerCase())))
        .map((c) => ({ email: c.email, name: c.name, contactId: c.id })),
    )
  }

  if (input.targetType === "contacts") {
    const ids = new Set(input.targetContactIds ?? [])
    return dedupeRecipients(
      contacts.filter((c) => ids.has(c.id)).map((c) => ({ email: c.email, name: c.name, contactId: c.id })),
    )
  }

  // event attendees
  if (!input.targetEventId) return []
  const statusFilter = input.recipientStatus ?? "both"
  let statuses: string[] = ["confirmed"]
  if (statusFilter === "waitlisted") statuses = ["waitlisted"]
  if (statusFilter === "both") statuses = ["confirmed", "waitlisted"]

  const { data: regs } = await supabase
    .from("registrations")
    .select("attendee_id, status")
    .eq("event_id", input.targetEventId)
    .in("status", statuses)
  const attendeeIds = [...new Set((regs ?? []).map((r: any) => r.attendee_id))]
  if (attendeeIds.length === 0) return []

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, user:users(email)")
    .in("id", attendeeIds)

  const contactByEmail = new Map(contacts.map((c) => [c.email.toLowerCase(), c]))
  const recipients: ResolvedRecipient[] = []
  for (const profile of profiles ?? []) {
    const email = (profile as any)?.user?.email as string | undefined
    if (!email) continue
    const contact = contactByEmail.get(email.toLowerCase())
    recipients.push({
      email,
      name: contact?.name || `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(),
      contactId: contact?.id,
    })
  }
  return dedupeRecipients(recipients)
}

export async function createCampaign(input: CampaignInput, createdBy: string): Promise<EmailCampaign> {
  const recipients = await resolveCampaignRecipients(input)
  const provider = getEmailProvider()
  const status: CampaignStatus = input.sendNow ? "draft" : input.scheduledAt ? "scheduled" : "draft"

  const { data, error } = await supabase
    .from("email_campaigns")
    .insert({
      name: input.name,
      subject: input.subject,
      body: input.body,
      target_type: input.targetType,
      target_event_id: input.targetEventId || null,
      target_tags: input.targetTags ?? [],
      target_contact_ids: input.targetContactIds ?? [],
      recipient_status: input.recipientStatus ?? "both",
      scheduled_at: input.scheduledAt || null,
      status,
      provider,
      total_recipients: recipients.length,
      created_by: createdBy,
    })
    .select()
    .single()
  if (error) throw error

  if (recipients.length > 0) {
    const { error: recipientError } = await supabase.from("email_campaign_recipients").insert(
      recipients.map((r) => ({
        campaign_id: data.id,
        contact_id: r.contactId ?? null,
        email: r.email,
        status: "pending",
      })),
    )
    if (recipientError) throw recipientError
  }

  const campaign = mapCampaign(data)
  if (input.sendNow) return (await sendCampaign(campaign.id)) ?? campaign
  return campaign
}

export async function sendCampaign(campaignId: string): Promise<EmailCampaign | undefined> {
  const { data: campaignRow, error: campaignError } = await supabase
    .from("email_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single()
  if (campaignError) throw campaignError
  if (!campaignRow) return undefined
  const campaign = mapCampaign(campaignRow)
  if (campaign.status === "sent" || campaign.status === "cancelled") return campaign

  await supabase.from("email_campaigns").update({ status: "sending" }).eq("id", campaignId)

  const { data: pending } = await supabase
    .from("email_campaign_recipients")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("status", "pending")

  let sent = 0
  let failed = 0
  for (const raw of pending ?? []) {
    const message = {
      to: raw.email,
      subject: campaign.subject,
      body: campaign.body,
    }
    const result = await sendEmail(message)
    if (result.ok) {
      sent += 1
      await supabase
        .from("email_campaign_recipients")
        .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
        .eq("id", raw.id)
    } else {
      failed += 1
      await supabase
        .from("email_campaign_recipients")
        .update({ status: "failed", error: result.error ?? "Unknown email error" })
        .eq("id", raw.id)
    }
  }

  const status: CampaignStatus = sent === 0 && failed > 0 ? "failed" : "sent"
  const { data: updated } = await supabase
    .from("email_campaigns")
    .update({
      status,
      sent_count: campaign.sentCount + sent,
      failed_count: campaign.failedCount + failed,
      sent_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .select()
    .single()
  return updated ? mapCampaign(updated) : undefined
}

/** Sends every scheduled campaign whose time has arrived. */
export async function processDueCampaigns(): Promise<number> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("email_campaigns")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
  if (error && isMissingRelation(error)) return 0
  if (error) throw error
  let count = 0
  for (const row of data ?? []) {
    await sendCampaign(row.id)
    count += 1
  }
  return count
}

export async function cancelCampaign(id: string): Promise<void> {
  const { error } = await supabase.from("email_campaigns").update({ status: "cancelled" }).eq("id", id)
  if (error) throw error
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase.from("email_campaigns").delete().eq("id", id)
  if (error) throw error
}

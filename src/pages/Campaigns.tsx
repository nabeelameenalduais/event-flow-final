import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { runtimeFormatDateTime as formatDateTime, runtimeFormatDate as formatDate } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  Mail, Plus, Send, Trash2, XCircle, RefreshCw, Users, Eye,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Badge } from "../components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { useAuth } from "../contexts/AuthContext"
import {
  getCampaigns,
  createCampaign,
  sendCampaign,
  cancelCampaign,
  deleteCampaign,
  processDueCampaigns,
  getCampaignRecipients,
  resolveCampaignRecipients,
} from "../services/campaignService"
import { getContacts, getAudienceAccess, allAudienceTags } from "../services/audienceService"
import { getAllEvents } from "../services/eventService"
import { getEmailProvider } from "../services/emailService"
import type {
  AudienceContact, CampaignStatus, CampaignTargetType, EmailCampaign, EmailCampaignRecipient,
  Event, RecipientStatusFilter,
} from "../types"

const statusVariant: Record<CampaignStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  scheduled: "outline",
  sending: "secondary",
  sent: "default",
  failed: "destructive",
  cancelled: "outline",
}

export function Campaigns() {
  const { t } = useLanguage()
  
  const { user, role } = useAuth()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const [contacts, setContacts] = useState<AudienceContact[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [runningDue, setRunningDue] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [details, setDetails] = useState<EmailCampaign | null>(null)
  const autoProcessed = useRef(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const access = await getAudienceAccess(user.id, role)
      const canSend = access.isAdmin || access.canSend
      setAllowed(canSend)
      if (!canSend) return
      const [campaignRows, contactRows, eventRows] = await Promise.all([
        getCampaigns(),
        getContacts(),
        getAllEvents(),
      ])
      setCampaigns(campaignRows)
      setContacts(contactRows)
      setEvents(eventRows)
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to load campaigns"))
    } finally {
      setLoading(false)
    }
  }, [role, user])

  useEffect(() => { load() }, [load])

  // Scheduled campaigns are processed whenever an authorized panel loads. The
  // guard prevents a reload loop when processing updates the campaign list.
  useEffect(() => {
    if (allowed !== true || autoProcessed.current) return
    autoProcessed.current = true
    processDueCampaigns()
      .then((count) => { if (count > 0) load() })
      .catch(() => { /* automatic processing is best-effort */ })
  }, [allowed, load])

  const handleRunDue = async () => {
    setRunningDue(true)
    try {
      const count = await processDueCampaigns()
      toast.success(count > 0
        ? (count === 1 ? t("Sent {count} due campaign", { count }) : t("Sent {count} due campaigns", { count }))
        : t("No campaigns are due"))
      load()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to process due campaigns"))
    } finally {
      setRunningDue(false)
    }
  }

  const handleSend = async (campaign: EmailCampaign) => {
    setBusyId(campaign.id)
    try {
      await sendCampaign(campaign.id)
      toast.success(t("Campaign sent"))
      load()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to send the campaign"))
    } finally {
      setBusyId(null)
    }
  }

  const handleCancel = async (campaign: EmailCampaign) => {
    setBusyId(campaign.id)
    try {
      await cancelCampaign(campaign.id)
      toast.success(t("Campaign cancelled"))
      load()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to cancel the campaign"))
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (campaign: EmailCampaign) => {
    if (!window.confirm(t('Delete campaign "{name}"?', { name: campaign.name }))) return
    setBusyId(campaign.id)
    try {
      await deleteCampaign(campaign.id)
      toast.success(t("Campaign deleted"))
      load()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to delete the campaign"))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <Loading text={t("Loading campaigns...")} />

  if (!allowed) {
    return (
      <div className="max-w-lg mx-auto text-center py-20 space-y-3">
        <Mail size={44} className="mx-auto text-muted-foreground opacity-40" />
        <h1 className="text-xl font-semibold">{t("Campaign access required")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("An administrator can grant temporary sending access from the audience access panel.")}
        </p>
      </div>
    )
  }

  const provider = getEmailProvider()
  const tags = allAudienceTags(contacts)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Mail size={24} /> {t("Email campaigns")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("Send to the audience database. Unsubscribed and deleted accounts are never included.\n            Scheduling is stored in the database; due campaigns are sent when an authorized panel loads or when you run them now.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={provider === "mock" ? "outline" : "default"}>
            {provider === "mock" ? t("Mock delivery") : t("Live: {provider}", { provider })}
          </Badge>
          <Button variant="outline" className="gap-2" onClick={handleRunDue} disabled={runningDue}>
            <RefreshCw size={15} className={runningDue ? "animate-spin" : ""} /> {t("Run due now")}
          </Button>
          <Button className="gap-2" onClick={() => setShowForm((v) => !v)}>
            <Plus size={16} /> {showForm ? t("Close form") : t("New campaign")}
          </Button>
        </div>
      </div>

      {provider === "mock" && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          {t("Mock mode is active. Messages are reported as sent but only logged to the console.\n          Set")} <code className="text-xs">VITE_EMAIL_PROVIDER</code>, <code className="text-xs">VITE_EMAIL_API_KEY</code> {t("and")}{" "}
          <code className="text-xs">VITE_EMAIL_FROM</code> {t("for real delivery.")}
        </div>
      )}

      {showForm && user && (
        <CampaignForm
          contacts={contacts}
          events={events}
          tags={tags}
          userId={user.id}
          onCancel={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">{t("Campaigns (")}{campaigns.length})</CardTitle></CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <EmptyState title={t("No campaigns yet")} description={t("Create a campaign to email your audience.")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Campaign")}</TableHead>
                  <TableHead>{t("Target")}</TableHead>
                  <TableHead>{t("Recipients")}</TableHead>
                  <TableHead>{t("Status")}</TableHead>
                  <TableHead>{t("Schedule")}</TableHead>
                  <TableHead className="text-right">{t("Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{campaign.subject}</p>
                    </TableCell>
                    <TableCell className="text-sm capitalize">
                      {campaign.targetType === "all" ? t("All audience") : campaign.targetType === "event"
                        ? events.find((e) => e.id === campaign.targetEventId)?.title ?? t("Event")
                        : campaign.targetType === "tag" ? t("Tags: {tags}", { tags: campaign.targetTags.join(", ") || "—" }) : t("{count} contacts", { count: campaign.targetContactIds.length })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {campaign.sentCount}/{campaign.totalRecipients}
                      {campaign.failedCount > 0 && <span className="text-destructive"> · {t("{count} failed", { count: campaign.failedCount })}</span>}
                    </TableCell>
                    <TableCell><Badge variant={statusVariant[campaign.status]}>{t(campaign.status)}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {campaign.scheduledAt ? formatDateTime(campaign.scheduledAt) : campaign.sentAt ? t("Sent {date}", { date: formatDate(campaign.sentAt) }) : t("—")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        <Button size="sm" variant="ghost" className="gap-1" onClick={() => setDetails(campaign)}>
                          <Eye size={14} /> {t("View")}
                        </Button>
                        {(campaign.status === "draft" || campaign.status === "scheduled") && (
                          <>
                            <Button size="sm" variant="ghost" className="gap-1 text-primary" disabled={busyId === campaign.id} onClick={() => handleSend(campaign)}>
                              <Send size={14} /> {t("Send now")}
                            </Button>
                            <Button size="sm" variant="ghost" className="gap-1" disabled={busyId === campaign.id} onClick={() => handleCancel(campaign)}>
                              <XCircle size={14} /> {t("Cancel")}
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" className="text-destructive" disabled={busyId === campaign.id} onClick={() => handleDelete(campaign)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {details && <RecipientsDialog campaign={details} onClose={() => setDetails(null)} />}
    </div>
  )
}

function CampaignForm({
  contacts,
  events,
  tags,
  userId,
  onCancel,
  onSaved,
}: {
  contacts: AudienceContact[]
  events: Event[]
  tags: string[]
  userId: string
  onCancel: () => void
  onSaved: () => void
}) {
  const { t } = useLanguage()
  
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [targetType, setTargetType] = useState<CampaignTargetType>("all")
  const [targetEventId, setTargetEventId] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([])
  const [recipientStatus, setRecipientStatus] = useState<RecipientStatusFilter>("both")
  const [sendMode, setSendMode] = useState<"now" | "schedule" | "draft">("now")
  const [scheduledAt, setScheduledAt] = useState("")
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<number | null>(null)

  const subscribed = useMemo(() => contacts.filter((c) => c.status === "subscribed"), [contacts])

  useEffect(() => {
    let cancelled = false
    resolveCampaignRecipients({
      targetType,
      targetEventId: targetEventId || undefined,
      targetTags: selectedTags,
      targetContactIds: selectedContactIds,
      recipientStatus,
    })
      .then((rows) => { if (!cancelled) setPreview(rows.length) })
      .catch(() => { if (!cancelled) setPreview(null) })
    return () => { cancelled = true }
  }, [recipientStatus, selectedContactIds, selectedTags, targetEventId, targetType])

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])
  }

  const toggleContact = (id: string) => {
    setSelectedContactIds((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id])
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createCampaign(
        {
          name,
          subject,
          body,
          targetType,
          targetEventId: targetType === "event" ? targetEventId : undefined,
          targetTags: targetType === "tag" ? selectedTags : [],
          targetContactIds: targetType === "contacts" ? selectedContactIds : [],
          recipientStatus,
          scheduledAt: sendMode === "schedule" ? new Date(scheduledAt).toISOString() : undefined,
          sendNow: sendMode === "now",
        },
        userId,
      )
      toast.success(localizeToast(sendMode === "now" ? "Campaign sent" : sendMode === "schedule" ? "Campaign scheduled" : "Campaign saved as draft"))
      onSaved()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to save the campaign"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t("New campaign")}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t("Internal name")}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder={t("Spring newsletter")} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("Subject")}</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder={t("Email subject")} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("Body")}</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} required
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
              placeholder={t("Write the message. Plain text line breaks are preserved.")} />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t("Audience")}</label>
              <select value={targetType} onChange={(e) => setTargetType(e.target.value as CampaignTargetType)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="all">{t("All subscribed contacts")}</option>
                <option value="tag">{t("Contacts with selected tags")}</option>
                <option value="event">{t("Event attendees")}</option>
                <option value="contacts">{t("Selected contacts")}</option>
              </select>
            </div>
            {targetType === "event" && (
              <div>
                <label className="block text-sm font-medium mb-1">{t("Event")}</label>
                <select value={targetEventId} onChange={(e) => setTargetEventId(e.target.value)} required
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  <option value="">{t("Select an event")}</option>
                  {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                </select>
              </div>
            )}
            {targetType === "event" && (
              <div>
                <label className="block text-sm font-medium mb-1">{t("Registration status")}</label>
                <select value={recipientStatus} onChange={(e) => setRecipientStatus(e.target.value as RecipientStatusFilter)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                  <option value="both">{t("Confirmed + waitlisted")}</option>
                  <option value="confirmed">{t("Confirmed only")}</option>
                  <option value="waitlisted">{t("Waitlisted only")}</option>
                </select>
              </div>
            )}
          </div>

          {targetType === "tag" && (
            <div>
              <label className="block text-sm font-medium mb-1">{t("Tags")}</label>
              {tags.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("No tags exist yet.")}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button key={tag} type="button" onClick={() => toggleTag(tag)}>
                      <Badge variant={selectedTags.includes(tag) ? "default" : "outline"}>{tag}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {targetType === "contacts" && (
            <div>
              <label className="block text-sm font-medium mb-1">{t("Contacts (")}{selectedContactIds.length} {t("selected)")}</label>
              <div className="max-h-44 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {subscribed.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3">{t("No subscribed contacts.")}</p>
                ) : subscribed.map((contact) => (
                  <label key={contact.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={selectedContactIds.includes(contact.id)} onChange={() => toggleContact(contact.id)} />
                    <span className="flex-1 truncate">{contact.name || contact.email}</span>
                    <span className="text-xs text-muted-foreground truncate">{contact.email}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
            <span className="text-sm flex items-center gap-2"><Users size={15} /> {t("Estimated recipients:")} <strong>{preview ?? t("—")}</strong></span>
            <span className="text-xs text-muted-foreground">{t("Unsubscribed and deleted accounts are excluded automatically.")}</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t("Delivery")}</label>
              <select value={sendMode} onChange={(e) => setSendMode(e.target.value as typeof sendMode)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="now">{t("Send immediately")}</option>
                <option value="schedule">{t("Schedule")}</option>
                <option value="draft">{t("Save as draft")}</option>
              </select>
            </div>
            {sendMode === "schedule" && (
              <div>
                <label className="block text-sm font-medium mb-1">{t("Scheduled time")}</label>
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>{t("Cancel")}</Button>
            <Button type="submit" disabled={saving} className="gap-2">
              <Send size={15} /> {saving ? t("Saving...") : sendMode === "now" ? t("Create & send") : sendMode === "schedule" ? t("Schedule campaign") : t("Save draft")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function RecipientsDialog({ campaign, onClose }: { campaign: EmailCampaign; onClose: () => void }) {
  const { t } = useLanguage()
  
  const [rows, setRows] = useState<EmailCampaignRecipient[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCampaignRecipients(campaign.id)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [campaign.id])

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign.name}</DialogTitle>
          <DialogDescription>
            {campaign.subject} · {campaign.sentCount} {t("sent /")} {campaign.totalRecipients} {t("recipients")}
            {campaign.failedCount > 0 ? ` · ${t("{count} failed", { count: campaign.failedCount })}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm whitespace-pre-wrap mb-3">{campaign.body}</div>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("Loading recipients...")}</p>
        ) : rows.length === 0 ? (
          <EmptyState title={t("No recipients")} description={t("This campaign had no eligible recipients.")} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Email")}</TableHead>
                <TableHead>{t("Status")}</TableHead>
                <TableHead>{t("Sent at")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm">{row.email}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === "sent" ? "default" : row.status === "failed" ? "destructive" : "outline"}>{t(row.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.sentAt ? formatDateTime(row.sentAt) : row.error ?? t("—")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  )
}

import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { runtimeFormatDateTime as formatDateTime, runtimeFormatDate as formatDate } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  Megaphone, Plus, Send, Trash2, XCircle, RefreshCw, Users, Bell, Mail, Eye,
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
  getAdminMessages,
  createAdminMessage,
  sendAdminMessage,
  cancelAdminMessage,
  deleteAdminMessage,
  processDueAdminMessages,
  getAdminMessageRecipients,
  resolveMessageRecipients,
} from "../services/adminMessageService"
import { getAllEvents } from "../services/eventService"
import { getUsers } from "../services/userService"
import type {
  AdminMessage, AdminMessageChannel, AdminMessageRecipient, AdminMessageTarget,
  CampaignStatus, Event, RecipientStatusFilter,
} from "../types"

const statusVariant: Record<CampaignStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  scheduled: "outline",
  sending: "secondary",
  sent: "default",
  failed: "destructive",
  cancelled: "outline",
}

const statusLabel: Record<CampaignStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  cancelled: "Cancelled",
}

const channelLabel: Record<AdminMessageChannel, string> = {
  in_app: "In-app",
  email: "Email",
  both: "In-app + email",
}

export function Broadcast() {
  const { t } = useLanguage()
  
  const { user } = useAuth()
  const [messages, setMessages] = useState<AdminMessage[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [runningDue, setRunningDue] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [details, setDetails] = useState<AdminMessage | null>(null)
  const autoProcessed = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [messageRows, eventRows, userRows] = await Promise.all([
        getAdminMessages(),
        getAllEvents(),
        getUsers({ pageSize: 500 }),
      ])
      setMessages(messageRows)
      setEvents(eventRows)
      setUsers(userRows.items)
    } catch (err) {
      setLoadError(true)
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to load broadcasts"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Scheduled broadcasts are delivered whenever the admin panel loads. The
  // guard prevents a reload loop when delivery updates the message list.
  useEffect(() => {
    if (autoProcessed.current) return
    autoProcessed.current = true
    processDueAdminMessages()
      .then((count) => { if (count > 0) load() })
      .catch(() => { /* automatic processing is best-effort */ })
  }, [load])

  const handleRunDue = async () => {
    setRunningDue(true)
    try {
      const count = await processDueAdminMessages()
      toast.success(localizeToast(count > 0 ? `Delivered ${count} due message${count === 1 ? "" : "s"}` : "No messages are due"))
      load()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to process due messages"))
    } finally {
      setRunningDue(false)
    }
  }

  const handleSend = async (message: AdminMessage) => {
    setBusyId(message.id)
    try {
      await sendAdminMessage(message.id)
      toast.success(t("Broadcast delivered"))
      load()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to send the broadcast"))
    } finally {
      setBusyId(null)
    }
  }

  const handleCancel = async (message: AdminMessage) => {
    setBusyId(message.id)
    try {
      await cancelAdminMessage(message.id)
      toast.success(t("Broadcast cancelled"))
      load()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to cancel the broadcast"))
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (message: AdminMessage) => {
    if (!window.confirm(t('Delete broadcast "{title}"?', { title: message.title }))) return
    setBusyId(message.id)
    try {
      await deleteAdminMessage(message.id)
      toast.success(t("Broadcast deleted"))
      load()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to delete the broadcast"))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <Loading text={t("Loading broadcasts...")} />
  if (loadError) {
    return (
      <Card role="alert">
        <CardHeader><CardTitle>{t("Couldn't load broadcasts")}</CardTitle></CardHeader>
        <CardContent>
          <Button className="mt-4" onClick={load}>{t("Try again")}</Button>
        </CardContent>
      </Card>
    )
  }

  const pending = messages.filter((m) => m.status === "draft" || m.status === "scheduled")
  const archive = messages.filter((m) => m.status !== "draft" && m.status !== "scheduled")

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Megaphone size={24} /> {t("Broadcast messages")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("Send a notification to the in-app inbox, by email, or both. Target everyone, one event's attendees, or selected users.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={handleRunDue} disabled={runningDue}>
            <RefreshCw size={15} className={runningDue ? "animate-spin" : ""} /> {t("Run due now")}
          </Button>
          <Button className="gap-2" onClick={() => setShowForm((v) => !v)}>
            <Plus size={16} /> {showForm ? t("Close form") : t("New broadcast")}
          </Button>
        </div>
      </div>

      {showForm && user && (
        <BroadcastForm
          events={events}
          users={users}
          userId={user.id}
          onCancel={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">{t("Pending broadcasts (")}{pending.length})</CardTitle></CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <EmptyState title={t("Nothing pending")} description={t("Drafts and scheduled broadcasts appear here.")} />
          ) : (
            <MessageTable
              messages={pending} events={events} busyId={busyId}
              onSend={handleSend} onCancel={handleCancel} onDelete={handleDelete} onView={setDetails}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("Delivery archive (")}{archive.length})</CardTitle></CardHeader>
        <CardContent>
          {archive.length === 0 ? (
            <EmptyState title={t("No delivered broadcasts")} description={t("Sent, failed and cancelled broadcasts are archived here with delivery counts.")} />
          ) : (
            <MessageTable
              messages={archive} events={events} busyId={busyId} readOnly
              onSend={handleSend} onCancel={handleCancel} onDelete={handleDelete} onView={setDetails}
            />
          )}
        </CardContent>
      </Card>

      {details && <RecipientsDialog message={details} onClose={() => setDetails(null)} />}
    </div>
  )
}

function MessageTable({
  messages, events, busyId, readOnly, onSend, onCancel, onDelete, onView,
}: {
  messages: AdminMessage[]
  events: Event[]
  busyId: string | null
  readOnly?: boolean
  onSend: (message: AdminMessage) => void
  onCancel: (message: AdminMessage) => void
  onDelete: (message: AdminMessage) => void
  onView: (message: AdminMessage) => void
}) {
  const { t } = useLanguage()
  
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("Message")}</TableHead>
          <TableHead>{t("Target")}</TableHead>
          <TableHead>{t("Channel")}</TableHead>
          <TableHead>{t("Delivery")}</TableHead>
          <TableHead>{t("Status")}</TableHead>
          <TableHead>{t("Schedule")}</TableHead>
          <TableHead className="text-right">{t("Actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {messages.map((message) => (
          <TableRow key={message.id}>
            <TableCell>
              <p className="font-medium text-sm">{message.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{message.body}</p>
            </TableCell>
            <TableCell className="text-sm">
              {message.targetType === "all" ? t("All active users")
                : message.targetType === "event" ? events.find((e) => e.id === message.eventId)?.title ?? t("Event")
                : t("{count} selected users", { count: message.userIds.length })}
            </TableCell>
            <TableCell className="text-sm">
              <span className="flex items-center gap-1">
                {message.channel !== "email" && <Bell size={13} />}
                {message.channel !== "in_app" && <Mail size={13} />}
                {t(channelLabel[message.channel])}
              </span>
            </TableCell>
            <TableCell className="text-sm">
              {message.sentCount}/{message.totalRecipients}
              {message.failedCount > 0 && <span className="text-destructive"> · {message.failedCount} {t("failed")}</span>}
            </TableCell>
            <TableCell><Badge variant={statusVariant[message.status]}>{t(statusLabel[message.status])}</Badge></TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {message.scheduledAt ? formatDateTime(message.scheduledAt) : message.sentAt ? `${t("Sent")} ${formatDate(message.sentAt)}` : t("—")}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1 flex-wrap">
                <Button size="sm" variant="ghost" className="gap-1" onClick={() => onView(message)}>
                  <Eye size={14} /> {t("View")}
                </Button>
                {!readOnly && (
                  <>
                    <Button size="sm" variant="ghost" className="gap-1 text-primary" disabled={busyId === message.id} onClick={() => onSend(message)}>
                      <Send size={14} /> {t("Send now")}
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1" disabled={busyId === message.id} onClick={() => onCancel(message)}>
                      <XCircle size={14} /> {t("Cancel")}
                    </Button>
                  </>
                )}
                <Button size="sm" variant="ghost" className="text-destructive" disabled={busyId === message.id} onClick={() => onDelete(message)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function BroadcastForm({
  events, users, userId, onCancel, onSaved,
}: {
  events: Event[]
  users: any[]
  userId: string
  onCancel: () => void
  onSaved: () => void
}) {
  const { t } = useLanguage()
  
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [link, setLink] = useState("")
  const [channel, setChannel] = useState<AdminMessageChannel>("in_app")
  const [targetType, setTargetType] = useState<AdminMessageTarget>("all")
  const [eventId, setEventId] = useState("")
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [recipientStatus, setRecipientStatus] = useState<RecipientStatusFilter>("both")
  const [sendMode, setSendMode] = useState<"now" | "schedule" | "draft">("now")
  const [scheduledAt, setScheduledAt] = useState("")
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<number | null>(null)

  const activeUsers = useMemo(() => users.filter((u) => !u.deletedAt && !u.suspended), [users])

  useEffect(() => {
    let cancelled = false
    resolveMessageRecipients({
      targetType,
      eventId: eventId || undefined,
      userIds: selectedUserIds,
      recipientStatus,
    })
      .then((rows) => { if (!cancelled) setPreview(rows.length) })
      .catch(() => { if (!cancelled) setPreview(null) })
    return () => { cancelled = true }
  }, [eventId, recipientStatus, selectedUserIds, targetType])

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) => prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id])
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createAdminMessage(
        {
          title,
          body,
          link: link || undefined,
          channel,
          targetType,
          eventId: targetType === "event" ? eventId : undefined,
          userIds: targetType === "users" ? selectedUserIds : [],
          recipientStatus,
          scheduledAt: sendMode === "schedule" ? new Date(scheduledAt).toISOString() : undefined,
          sendNow: sendMode === "now",
        },
        userId,
      )
      toast.success(localizeToast(sendMode === "now" ? "Broadcast delivered" : sendMode === "schedule" ? "Broadcast scheduled" : "Broadcast saved as draft"))
      onSaved()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to save the broadcast"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t("New broadcast")}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("Title")}</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder={t("Important update")} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("Message")}</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} required
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
              placeholder={t("Write the message that users will receive.")} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t("Optional link")}</label>
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/dashboard/events" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("Channel")}</label>
              <select value={channel} onChange={(e) => setChannel(e.target.value as AdminMessageChannel)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="in_app">{t("In-app notification inbox")}</option>
                <option value="email">{t("Email")}</option>
                <option value="both">{t("In-app + email")}</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t("Target")}</label>
              <select value={targetType} onChange={(e) => setTargetType(e.target.value as AdminMessageTarget)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="all">{t("All active users")}</option>
                <option value="event">{t("Event attendees")}</option>
                <option value="users">{t("Selected users")}</option>
              </select>
            </div>
            {targetType === "event" && (
              <div>
                <label className="block text-sm font-medium mb-1">{t("Event")}</label>
                <select value={eventId} onChange={(e) => setEventId(e.target.value)} required
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

          {targetType === "users" && (
            <div>
              <label className="block text-sm font-medium mb-1">{t("Users (")}{selectedUserIds.length} {t("selected)")}</label>
              <div className="max-h-44 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {activeUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3">{t("No active users.")}</p>
                ) : activeUsers.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={selectedUserIds.includes(u.id)} onChange={() => toggleUser(u.id)} />
                    <span className="flex-1 truncate">{u.profile ? `${u.profile.firstName} ${u.profile.lastName}` : u.email}</span>
                    <span className="text-xs text-muted-foreground truncate">{u.email}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
            <span className="text-sm flex items-center gap-2"><Users size={15} /> {t("Estimated recipients:")} <strong>{preview ?? t("—")}</strong></span>
            <span className="text-xs text-muted-foreground">{t("Deleted and suspended accounts are excluded automatically.")}</span>
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
              <Send size={15} /> {saving ? t("Saving...") : sendMode === "now" ? t("Create & send") : sendMode === "schedule" ? t("Schedule broadcast") : t("Save draft")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function RecipientsDialog({ message, onClose }: { message: AdminMessage; onClose: () => void }) {
  const { t } = useLanguage()
  
  const [rows, setRows] = useState<AdminMessageRecipient[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAdminMessageRecipients(message.id)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [message.id])

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{message.title}</DialogTitle>
          <DialogDescription>
            {t(channelLabel[message.channel])} · {message.sentCount} {t("delivered /")} {message.totalRecipients} {t("recipients")}
            {message.failedCount > 0 ? ` · ${message.failedCount} ${t("failed")}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm whitespace-pre-wrap mb-3">{message.body}</div>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("Loading recipients...")}</p>
        ) : rows.length === 0 ? (
          <EmptyState title={t("No recipients")} description={t("This broadcast had no eligible recipients.")} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Email")}</TableHead>
                <TableHead>{t("In-app")}</TableHead>
                <TableHead>{t("Email")}</TableHead>
                <TableHead>{t("Error")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm">{row.email ?? t("—")}</TableCell>
                  <TableCell><Badge variant={row.inAppSent ? "default" : "outline"}>{row.inAppSent ? t("sent") : t("—")}</Badge></TableCell>
                  <TableCell><Badge variant={row.emailStatus === "sent" ? "default" : row.emailStatus === "failed" ? "destructive" : "outline"}>{t(row.emailStatus)}</Badge></TableCell>
                  <TableCell className="text-xs text-destructive">{row.error ?? t("—")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  )
}

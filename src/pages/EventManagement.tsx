import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { runtimeFormatDate as formatDate } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Pencil, Trash2, Copy, Archive, Eye, Calendar, MapPin, Users, Send, RotateCcw, ListOrdered, ClipboardList, ScanLine, UserPlus, Wallet, ClipboardCheck, MessageSquare, ShieldCheck, Search, ArrowUpDown } from "lucide-react"
import { toast } from "sonner"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { Input } from "../components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog"
import { useAuth } from "../contexts/AuthContext"
import { getEventsForUser, deleteEvent, duplicateEvent, publishEvent, archiveEvent, setDraft } from "../services/eventService"
import { sendEventReminder } from "../services/notificationService"
import { getVenues } from "../services/venueService"
import type { Event, Venue } from "../types"

const statusColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  published: "default",
  draft: "secondary",
  archived: "outline",
}

const PAGE_SIZE = 10

export function EventManagement() {
  const { t, tp } = useLanguage()

  const { profile, user, role } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sendingReminder, setSendingReminder] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [visibilityFilter, setVisibilityFilter] = useState("all")
  const [sort, setSort] = useState("date-desc")
  const [page, setPage] = useState(1)
  const [confirmAction, setConfirmAction] = useState<{ type: "delete" | "archive" | "draft"; event: Event } | null>(null)

  const fetch = useCallback(async () => {
    if (!profile || !user) return
    setLoading(true)
    setLoadError(null)
    try {
      const [data, v] = await Promise.all([
        getEventsForUser(profile.id, user.id, role ?? "attendee", profile.managesAllEvents ?? false),
        getVenues(),
      ])
      setEvents(data)
      setVenues(v)
    } catch (e: any) {
      setLoadError(localizeToast(e?.message ?? "Failed to load events"))
      toast.error(localizeToast(e?.message ?? "Failed to load events"))
    } finally {
      setLoading(false)
    }
  }, [profile, user, role])

  useEffect(() => { fetch() }, [fetch])

  const runAction = async (event: Event, key: string, action: () => Promise<unknown>, successKey: string, params?: Record<string, string>) => {
    setBusyAction(`${event.id}:${key}`)
    try {
      await action()
      toast.success(t(successKey, params))
      await fetch()
    } catch (e: any) {
      toast.error(localizeToast(e?.message ?? "Action failed"))
    } finally {
      setBusyAction(null)
    }
  }

  const handleDelete = async (event: Event) => {
    setConfirmAction({ type: "delete", event })
  }

  const handleDuplicate = async (event: Event) => {
    await runAction(event, "duplicate", () => duplicateEvent(event.id), '"{name}" duplicated as draft', { name: event.title })
  }

  const handlePublish = async (event: Event) => {
    await runAction(event, "publish", () => publishEvent(event.id), '"{name}" published', { name: event.title })
  }

  const handleArchive = async (event: Event) => {
    setConfirmAction({ type: "archive", event })
  }

  const handleDraft = async (event: Event) => {
    setConfirmAction({ type: "draft", event })
  }

  const confirmDestructiveAction = async () => {
    if (!confirmAction) return
    const { event, type } = confirmAction
    setConfirmAction(null)
    if (type === "delete") {
      await runAction(event, "delete", () => deleteEvent(event.id), '"{name}" deleted', { name: event.title })
    } else if (type === "archive") {
      await runAction(event, "archive", () => archiveEvent(event.id), '"{name}" archived', { name: event.title })
    } else {
      await runAction(event, "draft", () => setDraft(event.id), '"{name}" moved to draft', { name: event.title })
    }
  }

  const handleSendReminder = async (event: Event) => {
    setSendingReminder(event.id)
    try {
      const count = await sendEventReminder(event.id)
      if (count === 0) {
        toast.info(t("No confirmed attendees to remind"))
      } else {
        toast.success(tp("Reminder sent to {count} attendee", "Reminder sent to {count} attendees", count))
      }
    } catch (e: any) {
      toast.error(localizeToast(e?.message ?? "Failed to send reminder"))
    } finally {
      setSendingReminder(null)
    }
  }

  const filteredEvents = events
    .filter((event) => {
      const needle = search.trim().toLowerCase()
      const matchesSearch = !needle || event.title.toLowerCase().includes(needle)
      const matchesStatus = statusFilter === "all" || event.status === statusFilter
      const matchesVisibility = visibilityFilter === "all" || event.visibility === visibilityFilter
      return matchesSearch && matchesStatus && matchesVisibility
    })
    .sort((a, b) => {
      if (sort === "date-asc") return new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      if (sort === "title-asc") return a.title.localeCompare(b.title)
      if (sort === "title-desc") return b.title.localeCompare(a.title)
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    })

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginatedEvents = filteredEvents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  if (loading) return <Loading text={t("Loading events...")} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("My Events")}</h1>
        <Button onClick={() => navigate("/dashboard/events/new")} className="gap-2"><Plus size={16} /> {t("Create Event")}</Button>
      </div>

      {role === "admin" && (
        <p className="text-sm text-muted-foreground">{t("Showing all events (admin view)")}</p>
      )}

      {loadError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{loadError}</span>
          <Button size="sm" variant="outline" onClick={() => fetch()}>{t("Retry")}</Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("Search events...")} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder={t("Status")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("All statuses")}</SelectItem>
            <SelectItem value="draft">{t("draft")}</SelectItem>
            <SelectItem value="published">{t("published")}</SelectItem>
            <SelectItem value="archived">{t("archived")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={visibilityFilter} onValueChange={(v) => { setVisibilityFilter(v); setPage(1) }}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder={t("Visibility")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("All visibilities")}</SelectItem>
            <SelectItem value="public">{t("Public")}</SelectItem>
            <SelectItem value="private">{t("Private")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[180px]"><ArrowUpDown className="me-2 h-4 w-4" /><SelectValue placeholder={t("Sort")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date-desc">{t("Newest first")}</SelectItem>
            <SelectItem value="date-asc">{t("Oldest first")}</SelectItem>
            <SelectItem value="title-asc">{t("Title A-Z")}</SelectItem>
            <SelectItem value="title-desc">{t("Title Z-A")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredEvents.length === 0 ? (
        <EmptyState title={t("No events found")} description={t("Try changing your search or filters.")} />
      ) : (
        <div className="grid gap-4">
          {paginatedEvents.map((event) => (
            <div key={event.id} className="rounded-xl border border-border bg-card p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-semibold">{event.title}</span>
                    <Badge variant={statusColors[event.status] ?? "outline"}>{t(event.status)}</Badge>
                    <Badge variant="outline" className="text-xs">{t(event.visibility === "public" ? "Public" : "Private")}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar size={14} /> {formatDate(event.startDate)}</span>
                    <span className="flex items-center gap-1"><MapPin size={14} /> {venues.find((v) => v.id === event.venueId)?.name ?? t("Unknown venue")}</span>
                    <span className="flex items-center gap-1"><Users size={14} /> {event.capacity} {t("spots")}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/events/${event.id}/registrations`)}><ClipboardList size={14} />  {t("Registrations")}</Button>
                {event.visibility === "private" && (
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/events/${event.id}/invitations`)}><UserPlus size={14} />  {t("Invitations")}</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/events/${event.id}/attendance`)}><ScanLine size={14} />  {t("Attendance")}</Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/events/${event.id}/schedule`)}><ListOrdered size={14} />  {t("Schedule")}</Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/events/${event.id}/costs`)}><Wallet size={14} />  {t("Costs")}</Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/events/${event.id}/evaluation`)}><ClipboardCheck size={14} />  {t("Evaluation")}</Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/events/${event.id}/chat`)}><MessageSquare size={14} />  {t("Chat")}</Button>
                {role === "admin" && (
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/events/${event.id}/organizers`)}><ShieldCheck size={14} />  {t("Organizers")}</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => navigate(`/events/${event.id}`)}><Eye size={14} /> {t("View")}</Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/events/${event.id}/edit`)}><Pencil size={14} /> {t("Edit")}</Button>
                {event.status === "draft" && (
                  <Button size="sm" variant="ghost" className="text-green-600" disabled={busyAction === `${event.id}:publish`} onClick={() => handlePublish(event)}><Send size={14} />  {t("Publish")}</Button>
                )}
                {event.status === "published" && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => handleSendReminder(event)} disabled={sendingReminder === event.id}>
                      <Send size={14} /> {sendingReminder === event.id ? t("Sending...") : t("Send Reminder")}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busyAction === `${event.id}:archive`} onClick={() => handleArchive(event)}><Archive size={14} />  {t("Archive")}</Button>
                    <Button size="sm" variant="ghost" disabled={busyAction === `${event.id}:draft`} onClick={() => handleDraft(event)}><RotateCcw size={14} />  {t("Unpublish")}</Button>
                  </>
                )}
                {event.status === "archived" && (
                  <Button size="sm" variant="ghost" className="text-green-600" disabled={busyAction === `${event.id}:publish`} onClick={() => handlePublish(event)}><Send size={14} />  {t("Republish")}</Button>
                )}
                <Button size="sm" variant="ghost" disabled={busyAction === `${event.id}:duplicate`} onClick={() => handleDuplicate(event)}><Copy size={14} />  {t("Duplicate")}</Button>
                <Button size="sm" variant="ghost" className="text-destructive" disabled={busyAction === `${event.id}:delete`} onClick={() => handleDelete(event)}><Trash2 size={14} /> {t("Delete")}</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>{t("Previous")}</Button>
          <span className="text-sm text-muted-foreground">{t("Page {page} of {total}", { page: String(currentPage), total: String(totalPages) })}</span>
          <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>{t("Next")}</Button>
        </div>
      )}

      <Dialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Confirm action")}</DialogTitle>
            <DialogDescription>
              {confirmAction?.type === "delete"
                ? t('Delete "{name}"? This cannot be undone.', { name: confirmAction.event.title })
                : confirmAction?.type === "archive"
                  ? t('Archive "{name}"? Attendees will no longer see it published.', { name: confirmAction.event.title })
                  : t('Move "{name}" back to draft?', { name: confirmAction?.event.title ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>{t("Cancel")}</Button>
            <Button variant={confirmAction?.type === "delete" ? "destructive" : "default"} onClick={() => { if (confirmAction) confirmDestructiveAction() }}>{t("Confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

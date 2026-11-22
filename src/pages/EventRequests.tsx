import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { runtimeFormatDate as formatDate, runtimeFormatNumber as formatNumber } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect, useCallback, useMemo } from "react"
import { Link } from "react-router-dom"
import { Plus, ClipboardList, CheckCircle2, XCircle, HelpCircle, Eye } from "lucide-react"
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
  getEventRequests,
  setEventRequestStatus,
  approveEventRequest,
  type EventRequestWithRequester,
} from "../services/eventRequestService"
import { supabase } from "../lib/supabase"
import { getCategories } from "../services/categoryService"
import { getVenues } from "../services/venueService"
import {
  fromDateTimeLocal,
  getEventDateErrors,
  nextMinuteDateTimeLocal,
  toDateTimeLocal,
  type EventDateErrors,
} from "../utils/eventDates"
import type { Category, EventRequestStatus, EventType, Venue } from "../types"

const PAGE_SIZE = 10

const statusVariant: Record<EventRequestStatus, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  reviewing: "default",
  approved: "default",
  rejected: "destructive",
  needs_info: "outline",
}

/** Server-side transitions are enforced again by event_requests_set_status. */
const allowedTransitions: Record<EventRequestStatus, EventRequestStatus[]> = {
  pending: ["reviewing", "needs_info", "rejected", "approved"],
  reviewing: ["needs_info", "rejected", "approved"],
  needs_info: ["reviewing", "rejected", "approved"],
  approved: [],
  rejected: [],
}

type StatusFilter = "all" | EventRequestStatus
type SortKey = "newest" | "oldest" | "title"

export function EventRequests() {
  const { t, localizeError } = useLanguage()

  const { user, role } = useAuth()
  const isAdmin = role === "admin"
  const statusLabel = (value: string) => localizeError(value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
  const eventTypeLabel = (value: EventType) =>
    t(value === "in_person" ? "In person" : value === "online" ? "Online" : "Hybrid")
  const canChange = (from: EventRequestStatus, to: EventRequestStatus) =>
    allowedTransitions[from].includes(to)

  const [requests, setRequests] = useState<EventRequestWithRequester[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [organizers, setOrganizers] = useState<{ id: string; label: string }[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [approving, setApproving] = useState<EventRequestWithRequester | null>(null)
  const [statusPrompt, setStatusPrompt] = useState<{ request: EventRequestWithRequester; status: EventRequestStatus } | null>(null)
  const [statusNote, setStatusNote] = useState("")
  const [updating, setUpdating] = useState(false)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [sortBy, setSortBy] = useState<SortKey>("newest")
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const filter = statusFilter === "all" ? undefined : { status: statusFilter }
      const rows = await getEventRequests(
        isAdmin ? filter : { requesterId: user.id, status: filter?.status },
      )
      setRequests(rows)
    } catch (err) {
      setError(localizeToast(err instanceof Error ? err.message : "Failed to load event requests"))
    } finally {
      setLoading(false)
    }
  }, [isAdmin, user, statusFilter])

  // Reference data is independent of the requests fetch: a failure in one
  // must not empty the other.
  useEffect(() => {
    if (!isAdmin) return
    Promise.all([
      supabase
        .from("profiles")
        .select("id, first_name, last_name, role:roles!inner(name)")
        .eq("role.name", "organizer")
        .order("first_name"),
      getCategories(),
      getVenues(),
    ])
      .then(([organizerResult, categoryRows, venueRows]) => {
        if (organizerResult.error) throw organizerResult.error
        setOrganizers(
          (organizerResult.data ?? []).map((p: any) => ({
            id: p.id,
            label: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.id,
          })),
        )
        setCategories(categoryRows)
        setVenues(venueRows)
      })
      .catch((err) => {
        toast.error(localizeToast(err instanceof Error ? err.message : "Failed to load event requests"))
      })
  }, [isAdmin])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, statusFilter, sortBy])

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLowerCase()
    const rows = requests.filter((request) => {
      if (!query) return true
      return [request.title, request.description, request.requesterName, request.requesterEmail]
        .some((value) => value?.toLowerCase().includes(query))
    })
    return [...rows].sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title)
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return sortBy === "oldest" ? diff : -diff
    })
  }, [requests, search, sortBy])

  const totalPages = Math.max(1, Math.ceil(visibleRequests.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRequests = visibleRequests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const showingFrom = visibleRequests.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const showingTo = Math.min(currentPage * PAGE_SIZE, visibleRequests.length)

  const applyStatusChange = async (
    request: EventRequestWithRequester,
    status: EventRequestStatus,
    note: string,
  ) => {
    if (!user) return
    setUpdating(true)
    try {
      await setEventRequestStatus(request.id, status, note || undefined)
      toast.success(t("Request marked as {status}", { status: statusLabel(status) }))
      setStatusPrompt(null)
      setStatusNote("")
      load()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to update the request"))
    } finally {
      setUpdating(false)
    }
  }

  const changeStatus = (request: EventRequestWithRequester, status: EventRequestStatus) => {
    if (status === "needs_info" || status === "rejected") {
      setStatusPrompt({ request, status })
      setStatusNote("")
      return
    }
    applyStatusChange(request, status, "")
  }

  const pageHeader = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList size={24} /> {t("Event requests")}</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? t("Review requests from registered users. Approving a request creates a draft event that you configure.")
            : t("Track the requests you submitted. An administrator reviews each one.")}
        </p>
      </div>
      <Button asChild className="gap-2">
        <Link to="/dashboard/event-requests/new"><Plus size={16} /> {t("New request")}</Link>
      </Button>
    </div>
  )

  if (loading) return <Loading text={t("Loading event requests...")} />

  if (error) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <Card>
          <CardHeader><CardTitle className="text-base">{t("Couldn't load event requests")}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button className="mt-4" onClick={load}>{t("Try again")}</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {pageHeader}

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <label className="block text-sm font-medium mb-1">{t("Search requests")}</label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("Search by title, requester or description")}
              />
            </div>
            <div className="w-44">
              <label className="block text-sm font-medium mb-1">{t("Status")}</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
              >
                <option value="all">{t("All statuses")}</option>
                {(["pending", "reviewing", "needs_info", "rejected", "approved"] as EventRequestStatus[]).map((status) => (
                  <option key={status} value={status}>{statusLabel(status)}</option>
                ))}
              </select>
            </div>
            <div className="w-44">
              <label className="block text-sm font-medium mb-1">{t("Sort")}</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
              >
                <option value="newest">{t("Newest first")}</option>
                <option value="oldest">{t("Oldest first")}</option>
                <option value="title">{t("Title A–Z")}</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {visibleRequests.length === 0 ? (
        <EmptyState
          title={t("No event requests")}
          description={search || statusFilter !== "all"
            ? t("No requests match your filters.")
            : isAdmin
              ? t("Requests submitted by users will appear here.")
              : t("Submit your first event idea.")}
        />
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">{isAdmin ? t("All requests") : t("My requests")} ({visibleRequests.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Title")}</TableHead>
                  {isAdmin && <TableHead>{t("Requester")}</TableHead>}
                  <TableHead>{t("Type")}</TableHead>
                  <TableHead>{t("Budget")}</TableHead>
                  <TableHead>{t("Status")}</TableHead>
                  <TableHead>{t("Submitted")}</TableHead>
                  <TableHead className="text-right">{t("Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{request.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{request.description}</p>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-sm">
                        <p>{request.requesterName ?? t("User")}</p>
                        <p className="text-xs text-muted-foreground">{request.requesterEmail}</p>
                      </TableCell>
                    )}
                    <TableCell className="text-sm">{eventTypeLabel(request.eventType)}</TableCell>
                    <TableCell className="text-sm">
                      {request.estimatedBudget != null ? `${formatNumber(request.estimatedBudget)} ${request.currencyCode}` : t("—")}
                    </TableCell>
                    <TableCell><Badge variant={statusVariant[request.status]}>{statusLabel(request.status)}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(request.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        {isAdmin && request.status !== "approved" && request.status !== "rejected" && (
                          <>
                            {canChange(request.status, "reviewing") && (
                              <Button size="sm" variant="ghost" className="gap-1" onClick={() => changeStatus(request, "reviewing")}>
                                <Eye size={14} /> {t("Review")}
                              </Button>
                            )}
                            {canChange(request.status, "approved") && (
                              <Button size="sm" variant="ghost" className="gap-1 text-green-600" onClick={() => setApproving(request)}>
                                <CheckCircle2 size={14} /> {t("Approve")}
                              </Button>
                            )}
                            {canChange(request.status, "needs_info") && (
                              <Button size="sm" variant="ghost" className="gap-1" onClick={() => changeStatus(request, "needs_info")}>
                                <HelpCircle size={14} /> {t("Info")}
                              </Button>
                            )}
                            {canChange(request.status, "rejected") && (
                              <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => changeStatus(request, "rejected")}>
                                <XCircle size={14} /> {t("Reject")}
                              </Button>
                            )}
                          </>
                        )}
                        {request.createdEventId && (
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/dashboard/events/${request.createdEventId}/edit`}>{t("Open draft")}</Link>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
              <p className="text-sm text-muted-foreground">
                {t("Showing {from}–{to} of {total}", {
                  from: showingFrom,
                  to: showingTo,
                  total: visibleRequests.length,
                })}
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                  {t("Previous")}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {t("Page {page} of {total}", { page: currentPage, total: totalPages })}
                </span>
                <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
                  {t("Next")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {statusPrompt && (
        <Dialog open onOpenChange={(open) => { if (!open && !updating) setStatusPrompt(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t("Confirm {status}", { status: statusLabel(statusPrompt.status) })}
              </DialogTitle>
              <DialogDescription>{t("The requester will be notified about this status change.")}</DialogDescription>
            </DialogHeader>
            <div>
              <label className="block text-sm font-medium mb-1">{t("Optional note for the requester")}</label>
              <textarea
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                placeholder={t("Optional note for the requester")}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={updating} onClick={() => setStatusPrompt(null)}>{t("Cancel")}</Button>
              <Button disabled={updating} onClick={() => applyStatusChange(statusPrompt.request, statusPrompt.status, statusNote)}>
                {updating ? t("Saving...") : t("Confirm")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {approving && user && (
        <ApprovalDialog
          request={approving}
          organizers={organizers}
          categories={categories}
          venues={venues}
          onClose={() => setApproving(null)}
          onDone={() => { setApproving(null); load() }}
        />
      )}
    </div>
  )
}

function ApprovalDialog({
  request,
  organizers,
  categories,
  venues,
  onClose,
  onDone,
}: {
  request: EventRequestWithRequester
  organizers: { id: string; label: string }[]
  categories: Category[]
  venues: Venue[]
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useLanguage()

  // Both the initial value and the <option> values are profile ids, which is
  // what events.organizer_id references.
  const [organizerId, setOrganizerId] = useState(organizers[0]?.id ?? "")
  const [categoryId, setCategoryId] = useState(request.categoryId ?? categories[0]?.id ?? "")
  const [venueId, setVenueId] = useState(request.venueId ?? "")
  const [eventType, setEventType] = useState<EventType>(request.eventType)
  const [capacity, setCapacity] = useState(request.expectedAttendees ?? 50)
  const [onlineCapacity, setOnlineCapacity] = useState(request.expectedAttendees ?? 50)
  const [inPersonCapacity, setInPersonCapacity] = useState(request.expectedAttendees ?? 50)
  const [startDate, setStartDate] = useState(toDateTimeLocal(request.preferredStart))
  const [endDate, setEndDate] = useState(toDateTimeLocal(request.preferredEnd))
  const [deadline, setDeadline] = useState(toDateTimeLocal(request.preferredStart))
  const [dateErrors, setDateErrors] = useState<EventDateErrors>({})
  const [contactEmail, setContactEmail] = useState(request.requesterEmail ?? "")
  const [estimatedBudget, setEstimatedBudget] = useState(
    request.estimatedBudget != null ? String(request.estimatedBudget) : "",
  )
  const [currencyCode, setCurrencyCode] = useState(request.currencyCode || "USD")
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    // App-level validation keeps messages in the selected language instead of
    // the browser chrome locale.
    if (!organizerId) { toast.error(t("Select a valid organizer")); return }
    if (!categoryId) { toast.error(t("Select a valid category")); return }
    if (!/^\S+@\S+\.\S+$/.test(contactEmail)) { toast.error(t("Enter a valid contact email")); return }
    if (!deadline || !startDate || !endDate) { toast.error(t("Invalid event dates")); return }
    const errors = getEventDateErrors({ registrationDeadline: deadline, startDate, endDate })
    setDateErrors(errors)
    const firstError = Object.values(errors)[0]
    if (firstError) {
      toast.error(localizeToast(firstError))
      return
    }
    if (eventType === "hybrid"
        ? onlineCapacity < 1 || inPersonCapacity < 1
        : capacity < 1) {
      toast.error(t("Capacity must be greater than zero"))
      return
    }
    setSaving(true)
    try {
      await approveEventRequest(request.id, {
        organizerId,
        categoryId,
        venueId: venueId || undefined,
        eventType,
        capacity: eventType === "hybrid" ? onlineCapacity : capacity,
        onlineCapacity: eventType === "hybrid" ? onlineCapacity : undefined,
        inPersonCapacity: eventType === "hybrid" ? inPersonCapacity : undefined,
        startDate: fromDateTimeLocal(startDate),
        endDate: fromDateTimeLocal(endDate),
        registrationDeadline: fromDateTimeLocal(deadline),
        contactEmail,
        estimatedBudget: estimatedBudget.trim() ? Number(estimatedBudget) : undefined,
        currencyCode,
      })
      toast.success(t("Request approved and draft event created"))
      onDone()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to approve the request"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Approve “{name}”", { name: request.title })}</DialogTitle>
          <DialogDescription>
            {t("Enter the core event data. A draft event is created and the requester is notified.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("Organizer")}</label>
            <select value={organizerId} onChange={(e) => setOrganizerId(e.target.value)} required
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="">{t("Select an organizer")}</option>
              {organizers.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t("Category")}</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="">{t("Select category")}</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("Event type")}</label>
              <select value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="in_person">{t("In person")}</option>
                <option value="online">{t("Online")}</option>
                <option value="hybrid">{t("Hybrid")}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("Venue")}</label>
            <select value={venueId} onChange={(e) => setVenueId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="">{t("Not decided")}</option>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          {eventType === "hybrid" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">{t("Online capacity")}</label>
                <Input type="number" min={1} value={onlineCapacity} onChange={(e) => setOnlineCapacity(Number(e.target.value))} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("In-person capacity")}</label>
                <Input type="number" min={1} value={inPersonCapacity} onChange={(e) => setInPersonCapacity(Number(e.target.value))} required />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">{t("Capacity")}</label>
              <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} required />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t("Start")}</label>
              <Input type="datetime-local" value={startDate} min={toDateTimeLocal(deadline) || undefined}
                onChange={(e) => { setStartDate(e.target.value); setDateErrors({}) }} required />
              {dateErrors.startDate && <p className="text-xs text-destructive mt-1">{dateErrors.startDate}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("End")}</label>
              <Input type="datetime-local" value={endDate} min={nextMinuteDateTimeLocal(startDate)}
                onChange={(e) => { setEndDate(e.target.value); setDateErrors({}) }} required />
              {dateErrors.endDate && <p className="text-xs text-destructive mt-1">{dateErrors.endDate}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t("Registration deadline")}</label>
              <Input type="datetime-local" value={deadline} max={toDateTimeLocal(startDate) || undefined}
                onChange={(e) => { setDeadline(e.target.value); setDateErrors({}) }} required />
              {dateErrors.registrationDeadline && <p className="text-xs text-destructive mt-1">{dateErrors.registrationDeadline}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("Contact email")}</label>
              <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t("Estimated budget")}</label>
              <Input type="number" min={0} step="0.01" value={estimatedBudget}
                onChange={(e) => setEstimatedBudget(e.target.value)} placeholder={t("Optional — confirm or adjust")} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("Currency")}</label>
              <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                {[...new Set(["USD", "YER", "SAR", "EUR", "AED", request.currencyCode || "USD"])].map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>{t("Cancel")}</Button>
            <Button type="submit" disabled={saving}>{saving ? t("Creating...") : t("Approve & create draft")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

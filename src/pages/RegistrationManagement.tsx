import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { runtimeFormatDateTime as formatDateTime, runtimeFormatDate as formatDate } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Trash2, Users } from "lucide-react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { useAuth } from "../contexts/AuthContext"
import { getEventById, getRegistrations, deleteRegistrationHard } from "../services/eventService"
import { canManageEvent } from "../utils/eventAccess"
import { getProfilesByIds } from "../services/userService"
import type { Event, Registration } from "../types"

const statusColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  confirmed: "default",
  pending: "secondary",
  cancelled: "destructive",
  waitlisted: "outline",
}

type ModeFilter = "all" | "online" | "in_person"

function modeOf(reg: Registration): "in_person" | "online" {
  return reg.attendanceMode === "online" ? "online" : "in_person"
}

export function RegistrationManagement() {
  const { t } = useLanguage()
  
  const { eventId } = useParams<{ eventId: string }>()
  const { profile, role } = useAuth()
  const navigate = useNavigate()
  const [event, setEvent] = useState<Event | null>(null)
  const [eventTitle, setEventTitle] = useState("")
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [profileMap, setProfileMap] = useState<Map<string, any>>(new Map())
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all")
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    try {
      const data = await getEventById(eventId)
      if (!data) { navigate("/dashboard/events"); return }
      if (!(await canManageEvent(eventId, profile, role))) { navigate("/dashboard/events"); return }
      setEvent(data)
      setEventTitle(data.title)
      const regs = await getRegistrations(eventId)
      setRegistrations(regs)
      const attendeeIds = [...new Set(regs.map((r) => r.attendeeId))]
      if (attendeeIds.length > 0) {
        const profs = await getProfilesByIds(attendeeIds)
        setProfileMap(new Map(profs.map((p: any) => [p.id, p])))
      }
    } catch (e: any) {
      toast.error(localizeToast(e?.message ?? "Failed to load"))
    } finally {
      setLoading(false)
    }
  }, [eventId, navigate, profile, role])

  useEffect(() => { fetch() }, [fetch])

  // Numbering is based on registration order before any filter is applied, so a
  // filtered view still shows the real queue position.
  const confirmedOrdered = useMemo(
    () => registrations.filter((r) => r.status === "confirmed")
      .sort((a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime()),
    [registrations],
  )
  const waitlistOrdered = useMemo(
    () => registrations.filter((r) => r.status === "waitlisted")
      .sort((a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime()),
    [registrations],
  )
  const cancelled = useMemo(
    () => registrations.filter((r) => r.status === "cancelled")
      .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()),
    [registrations],
  )

  const confirmedPosition = useMemo(() => new Map(confirmedOrdered.map((r, i) => [r.id, i + 1])), [confirmedOrdered])
  const waitlistPosition = useMemo(() => new Map(waitlistOrdered.map((r, i) => [r.id, i + 1])), [waitlistOrdered])

  const byMode = (rows: Registration[]) =>
    modeFilter === "all" ? rows : rows.filter((r) => modeOf(r) === modeFilter)

  const visibleConfirmed = byMode(confirmedOrdered)
  const visibleWaitlist = byMode(waitlistOrdered)

  const handleRemove = async (reg: Registration) => {
    const attendee = profileMap.get(reg.attendeeId)
    const name = `${attendee?.firstName ?? ""} ${attendee?.lastName ?? ""}`.trim() || "this attendee"
    if (!window.confirm(`Permanently remove ${name}'s registration? They will be able to register again if seats are available.`)) return
    const reason = window.prompt("Optional reason (shown to the attendee):") ?? ""
    setRemovingId(reg.id)
    try {
      await deleteRegistrationHard(reg.id, reason || undefined)
      toast.success(t("Registration removed permanently"))
      fetch()
    } catch (e: any) {
      toast.error(localizeToast(e?.message ?? "Failed to remove registration"))
    } finally {
      setRemovingId(null)
    }
  }

  if (loading) return <Loading text={t("Loading registrations...")} />

  const isHybrid = event?.eventType === "hybrid"

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/events")} className="gap-2">
        <ArrowLeft size={16} /> {t("Back to Events")}
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("Registrations:")} {eventTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {t("Confirmed and waiting lists are numbered by registration order.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isHybrid && (
            <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value as ModeFilter)}
              className="px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="all">{t("All modes")}</option>
              <option value="in_person">{t("In person")}</option>
              <option value="online">{t("Online")}</option>
            </select>
          )}
          <Badge variant="secondary"><Users size={13} className="mr-1" /> {t("{count} total", { count: registrations.length })}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("Confirmed (")}{visibleConfirmed.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {visibleConfirmed.length === 0 ? (
            <EmptyState title={t("No confirmed registrations")} description={t("Confirmed attendees appear here in registration order.")} />
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">#</TableHead>
                    <TableHead>{t("Attendee")}</TableHead>
                    <TableHead>{t("Mode")}</TableHead>
                    <TableHead>{t("Registered")}</TableHead>
                    <TableHead className="text-right">{t("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleConfirmed.map((reg) => {
  
                    const attendee = profileMap.get(reg.attendeeId)
                    return (
                      <TableRow key={reg.id}>
                        <TableCell className="text-muted-foreground font-medium">{confirmedPosition.get(reg.id)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{attendee?.firstName} {attendee?.lastName}</p>
                            <p className="text-xs text-muted-foreground">{attendee?.email ?? t("ID: {id}", { id: reg.attendeeId })}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={modeOf(reg) === "online" ? "secondary" : "outline"}>
                            {modeOf(reg) === "online" ? t("online") : t("In person")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(reg.registeredAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" className="gap-1 text-destructive"
                            disabled={removingId === reg.id} onClick={() => handleRemove(reg)}>
                            <Trash2 size={14} /> {removingId === reg.id ? "Removing..." : t("Remove")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("Waiting list (")}{visibleWaitlist.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {visibleWaitlist.length === 0 ? (
            <EmptyState title={t("No one is waiting")} description={t("Attendees join the waiting list when the capacity for their mode is full.")} />
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">#</TableHead>
                    <TableHead>{t("Attendee")}</TableHead>
                    <TableHead>{t("Mode")}</TableHead>
                    <TableHead>{t("Registered")}</TableHead>
                    <TableHead className="text-right">{t("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleWaitlist.map((reg) => {
  
                    const attendee = profileMap.get(reg.attendeeId)
                    return (
                      <TableRow key={reg.id}>
                        <TableCell className="font-semibold text-amber-600">{waitlistPosition.get(reg.id)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{attendee?.firstName} {attendee?.lastName}</p>
                            <p className="text-xs text-muted-foreground">{attendee?.email ?? t("ID: {id}", { id: reg.attendeeId })}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={modeOf(reg) === "online" ? "secondary" : "outline"}>
                            {modeOf(reg) === "online" ? t("online") : t("In person")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(reg.registeredAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" className="gap-1 text-destructive"
                            disabled={removingId === reg.id} onClick={() => handleRemove(reg)}>
                            <Trash2 size={14} /> {removingId === reg.id ? "Removing..." : t("Remove")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {cancelled.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("Cancelled (")}{cancelled.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Attendee")}</TableHead>
                    <TableHead>{t("Status")}</TableHead>
                    <TableHead>{t("Registered")}</TableHead>
                    <TableHead className="text-right">{t("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cancelled.map((reg) => {
  
                    const attendee = profileMap.get(reg.attendeeId)
                    return (
                      <TableRow key={reg.id}>
                        <TableCell>
                          <p className="font-medium">{attendee?.firstName} {attendee?.lastName}</p>
                          <p className="text-xs text-muted-foreground">{attendee?.email ?? t("ID: {id}", { id: reg.attendeeId })}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusColors[reg.status] ?? "outline"}>{reg.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(reg.registeredAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" className="gap-1 text-destructive"
                            disabled={removingId === reg.id} onClick={() => handleRemove(reg)}>
                            <Trash2 size={14} /> {t("Delete")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

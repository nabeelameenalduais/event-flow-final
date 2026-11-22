import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { runtimeFormatTime as formatTime } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Search, Scan, Camera, CheckCircle, LogOut, User, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog"
import { QrScanner } from "../components/QrScanner"
import { useAuth } from "../contexts/AuthContext"
import { getEventById, getRegistrations } from "../services/eventService"
import { checkIn, checkOut, getAttendanceByEvent, findTicketByCode, getAttendanceByTicket, TicketError } from "../services/attendanceService"
import { getTicketsByRegistrations } from "../services/ticketService"
import { getProfilesByIds } from "../services/userService"
import type { Registration, Ticket, Attendance } from "../types"
import { canManageEvent } from "../utils/eventAccess"

export function AttendanceManagement() {
  const { t } = useLanguage()
  
  const { eventId } = useParams<{ eventId: string }>()
  const { profile, role } = useAuth()
  const navigate = useNavigate()
  const [eventTitle, setEventTitle] = useState("")
  const [isHybrid, setIsHybrid] = useState(false)
  const [modeFilter, setModeFilter] = useState<"all" | "online" | "in_person">("all")
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<Map<string, Attendance>>(new Map())
  const [ticketMap, setTicketMap] = useState<Map<string, Ticket>>(new Map())
  const [loading, setLoading] = useState(true)
  const [scanCode, setScanCode] = useState("")
  const [scanning, setScanning] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [profileMap, setProfileMap] = useState<Map<string, any>>(new Map())

  const [pendingConfirm, setPendingConfirm] = useState<{
    ticket: Ticket
    registration: Registration
    profile: any
    existingAtt: Attendance | null
    kind: "check_in" | "already_used"
  } | null>(null)

  const fetch = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    try {
      const event = await getEventById(eventId)
      if (!event) { navigate("/dashboard/events"); return }
      if (!(await canManageEvent(eventId, profile, role))) { navigate("/dashboard/events"); return }
      setEventTitle(event.title)
      setIsHybrid(event.eventType === "hybrid")
      const regs = await getRegistrations(eventId)
      const confirmed = regs.filter((r) => r.status === "confirmed").sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
      setRegistrations(confirmed)
      const att = await getAttendanceByEvent(eventId)
      const amap = new Map<string, Attendance>()
      const tmap = new Map<string, Ticket>()
      const regIds = confirmed.map((r) => r.id)
      if (regIds.length > 0) {
        const tkts = await getTicketsByRegistrations(regIds)
        const byReg = new Map<string, Ticket>()
        for (const t of tkts) {
          byReg.set(t.registrationId, t)
          tmap.set(t.registrationId, t)
        }
        const attendeeIds = [...new Set(confirmed.map((r) => r.attendeeId))]
        const profs = await getProfilesByIds(attendeeIds)
        setProfileMap(new Map(profs.map((p: any) => [p.id, p])))
      }
      for (const a of att) {
        amap.set(a.ticketId, a)
      }
      setAttendanceRecords(amap)
      setTicketMap(tmap)
    } catch (e: any) {
      toast.error(localizeToast(e?.message ?? "Failed to load"))
    } finally {
      setLoading(false)
    }
  }, [eventId, navigate, profile, role])

  useEffect(() => { fetch() }, [fetch])

  const handleCheckIn = async (reg: Registration) => {
    const ticket = ticketMap.get(reg.id)
    if (!ticket) { toast.error(t("No ticket found for this registration")); return }
    try {
      await checkIn(ticket.id, { mode: reg.attendanceMode, verifiedBy: profile?.userId, expectedEventId: eventId })
      toast.success(t("{name} checked in", { name: profileMap.get(reg.attendeeId)?.firstName ?? t("Attendee") }))
      fetch()
    } catch (e: any) {
      toast.error(localizeToast(e.message))
    }
  }

  const handleCheckOut = async (reg: Registration) => {
    const ticket = ticketMap.get(reg.id)
    if (!ticket) return
    const att = attendanceRecords.get(ticket.id)
    if (!att) { toast.error(t("No check-in record found")); return }
    try {
      await checkOut(att.id)
      toast.success(t("Checked out"))
      fetch()
    } catch (e: any) {
      toast.error(localizeToast(e?.message ?? "Failed to check out"))
    }
  }

  const lookupTicket = async (code: string) => {
  
    if (!code.trim()) return
    setScanning(true)
    try {
      // The event is passed in so a ticket from another event is rejected.
      const ticket = await findTicketByCode(code.trim(), eventId)
      const reg = registrations.find((r) => r.id === ticket.registrationId)
      if (!reg) {
        toast.error(t("This ticket is not on the confirmed list for this event"))
        setScanCode("")
        return
      }
      const attendee = profileMap.get(reg.attendeeId)
      const existingAtt = (await getAttendanceByTicket(ticket.id)) ?? null
      setPendingConfirm({
        ticket,
        registration: reg,
        profile: attendee,
        existingAtt,
        kind: ticket.status === "used" || existingAtt ? "already_used" : "check_in",
      })
    } catch (e: any) {
      toast.error(localizeToast(e instanceof TicketError ? e.message : (e?.message ?? "Failed to look up ticket")))
      setScanCode("")
    } finally {
      setScanning(false)
    }
  }

  const handleConfirmCheckIn = async () => {
    if (!pendingConfirm || pendingConfirm.kind !== "check_in") return
    const { ticket } = pendingConfirm
    try {
      await checkIn(ticket.id, {
        mode: pendingConfirm.registration.attendanceMode,
        source: "qr_scan",
        verifiedBy: profile?.userId,
        expectedEventId: eventId,
      })
      toast.success(t("{name} checked in", { name: pendingConfirm.profile?.firstName ?? t("Attendee") }))
      setScanCode("")
      fetch()
    } catch (e: any) {
      toast.error(
        localizeToast(e instanceof TicketError && e.code === "already_used"
          ? "This ticket has already been used"
          : (e?.message ?? "Failed to process check-in")),
      )
    } finally {
      setPendingConfirm(null)
      setScanning(false)
    }
  }

  const handleScanCheckOut = async () => {
    if (!pendingConfirm?.existingAtt) return
    try {
      await checkOut(pendingConfirm.existingAtt.id)
      toast.success(t("Checked out"))
      setPendingConfirm(null)
      fetch()
    } catch (e: any) {
      toast.error(localizeToast(e?.message ?? "Failed to check out"))
    }
  }

  const handleScan = () => {
    lookupTicket(scanCode)
  }

  const handleQrScan = (code: string) => {
    setShowScanner(false)
    lookupTicket(code)
  }

  if (loading) return <Loading text={t("Loading attendance...")} />

  const visibleRegistrations = modeFilter === "all"
    ? registrations
    : registrations.filter((r) => (r.attendanceMode ?? "in_person") === modeFilter)

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/events")} className="gap-2">
        <ArrowLeft size={16} /> {t("Back to Events")}
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("Attendance:")} {eventTitle}</h1>
        <div className="flex items-center gap-2">
          {isHybrid && (
            <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value as "all" | "online" | "in_person")}
              className="px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="all">{t("All modes")}</option>
              <option value="in_person">{t("In person")}</option>
              <option value="online">{t("Online")}</option>
            </select>
          )}
          <Badge variant="secondary">{t("{count} attendees", { count: visibleRegistrations.length })}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Scan size={16} /> {t("Scan Ticket")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder={t("Enter ticket code (e.g. EF-ABCDEFGHIJKL)")}
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleScan() }}
            />
            <Button onClick={handleScan} disabled={scanning || !scanCode.trim()} className="gap-2">
              <Search size={14} /> {scanning ? t("Looking up...") : "Find"}
            </Button>
            <Button onClick={() => setShowScanner(true)} variant="outline" className="gap-2">
              <Camera size={14} /> {t("Scan QR")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{t("Type a ticket code or scan the attendee's QR code")}</p>
          {showScanner && <QrScanner onScan={handleQrScan} onClose={() => setShowScanner(false)} />}
        </CardContent>
      </Card>

      <Dialog open={!!pendingConfirm} onOpenChange={(open) => { if (!open) setPendingConfirm(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {pendingConfirm?.kind === "already_used" ? t("Ticket Already Used") : t("Check In Attendee?")}
            </DialogTitle>
            <DialogDescription>
              {pendingConfirm?.kind === "already_used"
                ? t("This ticket has already been scanned and cannot be used for check-in again.")
                : t("Verify the attendee details before confirming.")}
            </DialogDescription>
          </DialogHeader>
          {pendingConfirm && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/50">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500/30 to-amber-500/30 flex items-center justify-center">
                  <User size={18} className="text-primary" />
                </div>
                <div>
                  <p className="font-medium">
                    {pendingConfirm.profile
                      ? `${pendingConfirm.profile.firstName} ${pendingConfirm.profile.lastName}`
                      : t("Attendee")}
                  </p>
                  <p className="text-xs text-muted-foreground">{pendingConfirm.ticket.uniqueCode}</p>
                </div>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>{t("Event:")} {eventTitle}</p>
                <p className="flex items-center gap-2">
                  {t("Status:")} {pendingConfirm.kind === "already_used" ? (
                    <Badge
                      variant={pendingConfirm.existingAtt?.checkOutTime ? "secondary" : "warning"}
                      className="gap-1"
                    >
                      {!pendingConfirm.existingAtt?.checkOutTime && <AlertTriangle size={12} />}
                      {pendingConfirm.existingAtt?.checkOutTime ? t("Checked in & out") : t("Already used")}
                    </Badge>
                  ) : (
                    <Badge variant="outline">{t("Not checked in")}</Badge>
                  )}
                </p>
                {pendingConfirm.existingAtt && (
                  <p>{t("Checked in at:")} {formatTime(pendingConfirm.existingAtt.checkInTime)}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setPendingConfirm(null)}>
                  {pendingConfirm.kind === "already_used" ? t("Close") : t("Cancel")}
                </Button>
                {pendingConfirm.kind === "check_in" ? (
                  <Button className="flex-1" onClick={handleConfirmCheckIn}>{t("Check In")}</Button>
                ) : pendingConfirm.existingAtt && !pendingConfirm.existingAtt.checkOutTime ? (
                  <Button className="flex-1" variant="secondary" onClick={handleScanCheckOut}>{t("Check Out")}</Button>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {visibleRegistrations.length === 0 ? (
        <EmptyState title={t("No confirmed registrations")} description={t("Only confirmed registrations can check in.")} />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Attendee")}</TableHead>
                <TableHead>{t("Mode")}</TableHead>
                <TableHead>{t("Ticket Code")}</TableHead>
                <TableHead>{t("Status")}</TableHead>
                <TableHead>{t("Check-in")}</TableHead>
                <TableHead>{t("Check-out")}</TableHead>
                <TableHead className="text-right">{t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRegistrations.map((reg) => {
  
                const attendee = profileMap.get(reg.attendeeId)
                const ticket = ticketMap.get(reg.id)
                const att = ticket ? attendanceRecords.get(ticket.id) : undefined
                return (
                  <TableRow key={reg.id}>
                    <TableCell>
                      <p className="font-medium">{attendee?.firstName} {attendee?.lastName}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={(att?.mode ?? reg.attendanceMode) === "online" ? "secondary" : "outline"}>
                        {(att?.mode ?? reg.attendanceMode) === "online" ? "Online" : t("In person")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded">{ticket?.uniqueCode ?? t("—")}</code>
                    </TableCell>
                    <TableCell>
                      {att ? (
                        <Badge variant="default" className="bg-green-600">{t("Checked In")}</Badge>
                      ) : (
                        <Badge variant="outline">{t("Not Checked In")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {att ? formatTime(att.checkInTime) : t("—")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {att?.checkOutTime ? formatTime(att.checkOutTime) : t("—")}
                    </TableCell>
                    <TableCell className="text-right">
                      {!att && (
                        <Button size="sm" variant="ghost" className="text-green-600" onClick={() => handleCheckIn(reg)}>
                          <CheckCircle size={14} /> {t("Check In")}
                        </Button>
                      )}
                      {att && !att.checkOutTime && (
                        <Button size="sm" variant="ghost" onClick={() => handleCheckOut(reg)}>
                          <LogOut size={14} /> {t("Check Out")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

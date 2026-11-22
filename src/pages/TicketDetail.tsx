import { runtimeFormatDate as formatDate } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Download, CheckCircle, AlertCircle, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { getTicketForOwner, downloadTicket, encodeTicketCode, buildTicketPayload } from "../services/ticketService"
import { getEventById, getAllRegistrations } from "../services/eventService"
import { useAuth } from "../contexts/AuthContext"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Loading } from "../components/ui/Loading"
import type { Ticket, Event, AttendanceMode } from "../types"
import QRCode from "qrcode"

export function TicketDetail() {
  const { t } = useLanguage()
  
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [event, setEvent] = useState<Event | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState("")
  const [attendanceMode, setAttendanceMode] = useState<AttendanceMode | undefined>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      if (!profile) {
        navigate("/login")
        return
      }
      let ticketData: Ticket | null = null
      try {
        ticketData = (await getTicketForOwner(id, profile.id)) ?? null
      } catch {
        ticketData = null
      }
      if (!ticketData) { setLoading(false); return }
      setTicket(ticketData)

      const allRegs = await getAllRegistrations()
      const reg = allRegs.find((r) => r.id === ticketData!.registrationId)
      let mode: AttendanceMode | undefined = ticketData.attendanceMode ?? reg?.attendanceMode
      if (reg) {
        const ev = await getEventById(reg.eventId)
        setEvent(ev ?? null)
        mode = mode ?? (ev?.eventType === "online" ? "online" : ev?.eventType === "in_person" ? "in_person" : undefined)
      }
      setAttendanceMode(mode)

      // Always render the full, canonical payload — never the bare code — so
      // the QR identifies the event and registration even for legacy tickets.
      const payload = ticketData.qrPayload
        ? ticketData.qrPayload
        : encodeTicketCode(buildTicketPayload({
            code: ticketData.uniqueCode,
            eventId: reg?.eventId,
            registrationId: ticketData.registrationId,
            mode,
          }))
      try {
        setQrCodeUrl(await QRCode.toDataURL(payload, { width: 300, margin: 2 }))
      } catch {
        setQrCodeUrl(ticketData.qrCodeUrl)
      }
      setLoading(false)
    })()
  }, [id, profile, navigate])

  const handleDownload = async () => {
    if (!ticket) return
    try {
      await downloadTicket(ticket.id)
      toast.success(t("Ticket downloaded"))
    } catch {
      toast.error(t("Failed to download ticket"))
    }
  }

  if (loading) return <Loading text={t("Loading ticket...")} />
  if (!ticket) return <div className="text-center py-12 text-muted-foreground">{t("Ticket not found")}</div>

  return (
    <div className="max-w-lg mx-auto space-y-6 py-8">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft size={16} /> {t("Back to Dashboard")}
      </Link>
      <Card className="border-2 border-primary/20">
        <CardHeader className="text-center border-b border-border pb-6">
          <CardTitle className="text-2xl">{event?.title ?? t("Event Ticket")}</CardTitle>
          <p className="text-sm text-muted-foreground">{event ? formatDate(event.startDate) : ""}</p>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {ticket.status !== "valid" && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                {ticket.status === "used"
                  ? t("This ticket has already been used for check-in.")
                  : t("This ticket is no longer valid.")}
              </span>
            </div>
          )}
          {qrCodeUrl && (
            <div>
              <div className="flex justify-center">
                <img src={qrCodeUrl} alt={t("QR Code")} className="w-48 h-48 border border-border rounded-lg" />
              </div>
              <p className="text-center text-xs text-muted-foreground mt-3">
                {t("Show this QR code at the check-in desk")}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("Ticket Code")}</span>
              <span className="font-mono font-medium">{ticket.uniqueCode}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("Attendance")}</span>
              <span>
                {attendanceMode === "online" ? "Online" : attendanceMode === "in_person" ? t("In person") : t("—")}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("Issued")}</span>
              <span>{formatDate(ticket.issuedAt)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("Status")}</span>
              <Badge variant={ticket.status === "valid" ? "default" : ticket.status === "used" ? "secondary" : "destructive"}>
                {ticket.status === "valid" && <CheckCircle size={12} className="mr-1" />}
                {ticket.status === "invalid" && <AlertCircle size={12} className="mr-1" />}
                {ticket.status}
              </Badge>
            </div>
          </div>

          <Button className="w-full" onClick={handleDownload}>
            <Download size={16} /> {t("Download Ticket")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, Trash2, ShieldCheck, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { useAuth } from "../contexts/AuthContext"
import { getEventById } from "../services/eventService"
import {
  getEventOrganizers, getAllOrganizers, assignOrganizer, removeOrganizer,
  type OrganizerInfo,
} from "../services/organizerService"

export function EventOrganizers() {
  const { t } = useLanguage()
  
  const { eventId } = useParams<{ eventId: string }>()
  const { profile, role } = useAuth()
  const navigate = useNavigate()

  const [eventTitle, setEventTitle] = useState("")
  const [assigned, setAssigned] = useState<OrganizerInfo[]>([])
  const [allOrganizers, setAllOrganizers] = useState<OrganizerInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const fetch = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    try {
      const event = await getEventById(eventId)
      if (!event) { navigate("/dashboard/events"); return }
      if (role !== "admin") { navigate("/dashboard/events"); return }
      setEventTitle(event.title)
      const [a, all] = await Promise.all([getEventOrganizers(eventId), getAllOrganizers()])
      setAssigned(a)
      setAllOrganizers(all)
    } catch (e: any) {
      toast.error(localizeToast(e?.message ?? "Failed to load"))
    } finally {
      setLoading(false)
    }
  }, [eventId, navigate, role])

  useEffect(() => { fetch() }, [fetch])

  const assigneeIds = new Set(assigned.map((o) => o.userId))

  const handleAssign = async (userId: string) => {
    if (!eventId || !profile) return
    setBusy(true)
    try {
      await assignOrganizer(eventId, userId, profile.userId)
      toast.success(t("Organizer added"))
      fetch()
    } catch {
      toast.error(t("Failed to add organizer"))
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (userId: string) => {
    if (!eventId) return
    setBusy(true)
    try {
      await removeOrganizer(eventId, userId)
      toast.success(t("Organizer removed — chats stay archived"))
      fetch()
    } catch {
      toast.error(t("Failed to remove organizer"))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loading text={t("Loading organizers...")} />

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/events")} className="gap-2">
        <ArrowLeft size={16} /> {t("Back to Events")}
      </Button>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck size={22} className="text-primary" /> {t("Organizers:")} {eventTitle}
        </h1>
        <Badge variant="secondary">{t("{count} assigned", { count: assigned.length })}</Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        {t("Assign organizer accounts to help manage this event. Only admins can change organizer assignments. Removed organizers keep access to archived conversations.")}
      </p>

      <div className="rounded-lg border border-border">
        <div className="px-4 py-3 border-b border-border bg-muted/20 font-semibold">{t("Assigned Organizers")}</div>
        {assigned.length === 0 ? (
          <EmptyState title={t("No organizers assigned")} description={t("Add organizers below.")} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Name")}</TableHead>
                <TableHead>{t("Email")}</TableHead>
                <TableHead>{t("Role")}</TableHead>
                <TableHead className="text-right">{t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assigned.map((o) => (
                <TableRow key={o.userId}>
                  <TableCell className="font-medium">
                    {o.firstName} {o.lastName}
                    {o.isPrimary && <Badge variant="secondary" className="ml-2">{t("Primary")}</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{o.email}</TableCell>
                  <TableCell>
                    {o.managesAllEvents
                      ? <Badge variant="outline" className="text-teal-600">{t("All events")}</Badge>
                      : <Badge variant="secondary">{t("Event only")}</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {!o.isPrimary && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleRemove(o.userId)} disabled={busy}>
                        <Trash2 size={14} /> {t("Remove")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="rounded-lg border border-border">
        <div className="px-4 py-3 border-b border-border bg-muted/20 font-semibold">{t("Available Organizers")}</div>
        {allOrganizers.filter((o) => !assigneeIds.has(o.userId)).length === 0 ? (
          <EmptyState title={t("No more organizers available")} description={t("Create more organizer accounts or adjust assignments.")} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Name")}</TableHead>
                <TableHead>{t("Email")}</TableHead>
                <TableHead>{t("Scope")}</TableHead>
                <TableHead className="text-right">{t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allOrganizers.filter((o) => !assigneeIds.has(o.userId)).map((o) => (
                <TableRow key={o.userId}>
                  <TableCell className="font-medium">{o.firstName} {o.lastName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{o.email}</TableCell>
                  <TableCell>
                    {o.managesAllEvents
                      ? <Badge variant="outline" className="text-teal-600">{t("All events")}</Badge>
                      : <Badge variant="secondary">{t("Event only")}</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleAssign(o.userId)} disabled={busy}>
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}  {t("Assign")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

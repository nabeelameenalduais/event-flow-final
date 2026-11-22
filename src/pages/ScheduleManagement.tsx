import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { runtimeFormatTime as formatTime } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Plus, Pencil, Trash2, ArrowLeft, AlertTriangle, Clock, MapPin, User } from "lucide-react"
import { toast } from "sonner"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { useAuth } from "../contexts/AuthContext"
import { getEventById } from "../services/eventService"
import { canManageEvent } from "../utils/eventAccess"
import {
  getSessionsByEvent, createSession, updateSession, deleteSession,
  getSpeakersBySession, createSpeaker, updateSpeaker, deleteSpeaker, detectConflicts,
} from "../services/sessionService"
import {
  fromDateTimeLocal,
  getSessionTimeErrors,
  nextMinuteDateTimeLocal,
  toDateTimeLocal,
  validateSessionTimes,
  type SessionTimeErrors,
} from "../utils/eventDates"
import type { Session, Speaker } from "../types"

function SessionForm({ eventId, session, onClose }: { eventId: string; session?: Session; onClose: () => void }) {
  const { t } = useLanguage()
  
  const [title, setTitle] = useState(session?.title ?? "")
  const [description, setDescription] = useState(session?.description ?? "")
  const [startTime, setStartTime] = useState(toDateTimeLocal(session?.startTime))
  const [endTime, setEndTime] = useState(toDateTimeLocal(session?.endTime))
  const [timeErrors, setTimeErrors] = useState<SessionTimeErrors>({})
  const [roomName, setRoomName] = useState(session?.roomName ?? "")
  const [conflicts, setConflicts] = useState<Session[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!startTime || !endTime || validateSessionTimes({ startTime, endTime })) { setConflicts([]); return }
    const timer = setTimeout(async () => {
      const result = await detectConflicts(eventId, fromDateTimeLocal(startTime), fromDateTimeLocal(endTime), session?.id).catch(() => [])
      setConflicts(result)
    }, 300)
    return () => clearTimeout(timer)
  }, [startTime, endTime, eventId, session?.id])

  const handleSave = async () => {
    if (!title.trim() || !startTime || !endTime) return
    const errors = getSessionTimeErrors({ startTime, endTime })
    setTimeErrors(errors)
    const firstError = Object.values(errors)[0]
    if (firstError) {
      toast.error(localizeToast(firstError))
      return
    }
    setSaving(true)
    try {
      const data = {
        eventId,
        title,
        description,
        startTime: fromDateTimeLocal(startTime),
        endTime: fromDateTimeLocal(endTime),
        roomName,
      }
      if (session) {
        await updateSession(session.id, data)
        toast.success(t("Session updated"))
      } else {
        await createSession(data)
        toast.success(t("Session created"))
      }
      onClose()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Something went wrong"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">{t("Title")}</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("Session title")} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("Description")}</label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("Session description")} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t("Start time")}</label>
          <Input type="datetime-local" value={startTime}
            onChange={(e) => { setStartTime(e.target.value); setTimeErrors({}) }} />
          {timeErrors.startTime && <p className="text-xs text-destructive mt-1">{timeErrors.startTime}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("End time")}</label>
          <Input type="datetime-local" value={endTime} min={nextMinuteDateTimeLocal(startTime)}
            onChange={(e) => { setEndTime(e.target.value); setTimeErrors({}) }} />
          {timeErrors.endTime && <p className="text-xs text-destructive mt-1">{timeErrors.endTime}</p>}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("Room")}</label>
        <Input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder={t("e.g. Main Hall")} />
      </div>
      {conflicts.length > 0 && (
        <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center gap-2 text-sm font-medium text-yellow-800 dark:text-yellow-200">
            <AlertTriangle size={16} /> {t("Scheduling Conflict Detected")}
          </div>
          <ul className="mt-1 text-xs text-yellow-700 dark:text-yellow-300 list-disc list-inside">
            {conflicts.map((c) => (
              <li key={c.id}>{c.title} ({c.roomName}) — {formatTime(c.startTime, { hour: '2-digit', minute: '2-digit' })}</li>
            ))}
          </ul>
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t("Cancel")}</Button>
        <Button onClick={handleSave} disabled={saving || !title.trim() || !startTime || !endTime}>
          {saving ? t("Saving...") : session ? t("Update") : t("Create")}
        </Button>
      </DialogFooter>
    </div>
  )
}

function SpeakerForm({ sessionId, speaker, onClose }: { sessionId: string; speaker?: Speaker; onClose: () => void }) {
  const { t } = useLanguage()
  
  const [name, setName] = useState(speaker?.name ?? "")
  const [bio, setBio] = useState(speaker?.bio ?? "")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const data = { sessionId, name, bio, imageUrl: speaker?.imageUrl ?? "" }
      if (speaker) {
        await updateSpeaker(speaker.id, data)
        toast.success(t("Speaker updated"))
      } else {
        await createSpeaker(data)
        toast.success(t("Speaker added"))
      }
      onClose()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Something went wrong"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">{t("Name")}</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Speaker name")} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("Bio")}</label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={t("Brief biography")}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t("Cancel")}</Button>
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? t("Saving...") : speaker ? t("Update") : t("Add")}
        </Button>
      </DialogFooter>
    </div>
  )
}

export function ScheduleManagement() {
  const { t } = useLanguage()
  
  const { eventId } = useParams<{ eventId: string }>()
  const { profile, role } = useAuth()
  const navigate = useNavigate()
  const [eventTitle, setEventTitle] = useState("")
  const [sessions, setSessions] = useState<Session[]>([])
  const [speakersMap, setSpeakersMap] = useState<Record<string, Speaker[]>>({})
  const [loading, setLoading] = useState(true)
  const [sessionDialog, setSessionDialog] = useState(false)
  const [editingSession, setEditingSession] = useState<Session | undefined>()
  const [speakerDialog, setSpeakerDialog] = useState<string | null>(null)
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | undefined>()

  const fetch = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    try {
      const event = await getEventById(eventId)
      if (!event) { navigate("/dashboard/events"); return }
      if (!(await canManageEvent(eventId, profile, role))) { navigate("/dashboard/events"); return }
      setEventTitle(event.title)
      const sess = await getSessionsByEvent(eventId)
      setSessions(sess)
      const map: Record<string, Speaker[]> = {}
      for (const s of sess) { map[s.id] = await getSpeakersBySession(s.id) }
      setSpeakersMap(map)
    } catch (e: any) {
      toast.error(localizeToast(e?.message ?? "Failed to load"))
    } finally {
      setLoading(false)
    }
  }, [eventId, navigate, profile, role])

  useEffect(() => { fetch() }, [fetch])

  if (loading) return <Loading text={t("Loading schedule...")} />

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/events")} className="gap-2">
        <ArrowLeft size={16} /> {t("Back to Events")}
      </Button>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("Schedule:")} {eventTitle}</h1>
        <Button onClick={() => { setEditingSession(undefined); setSessionDialog(true) }} className="gap-2"><Plus size={16} /> {t("Add Session")}</Button>
      </div>

      {sessions.length === 0 ? (
        <EmptyState title={t("No sessions yet")} description={t("Add your first session to build the event agenda.")} />
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => {
  
            const sp = speakersMap[session.id] ?? []
            return (
              <Card key={session.id}>
                <CardHeader className="flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{session.title}</CardTitle>
                    <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock size={14} /> {formatTime(session.startTime, { hour: '2-digit', minute: '2-digit' })} {t("—")} {formatTime(session.endTime, { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="flex items-center gap-1"><MapPin size={14} /> {session.roomName}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditingSession(session); setSessionDialog(true) }}><Pencil size={14} /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                      try {
                        await deleteSession(session.id)
                        toast.success(t("Session deleted"))
                        fetch()
                      } catch (e: any) {
                        toast.error(localizeToast(e?.message ?? "Failed to delete session"))
                      }
                    }}><Trash2 size={14} /></Button>
                  </div>
                </CardHeader>
                {session.description && <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">{session.description}</p>
                </CardContent>}
                <CardContent className={session.description ? "pt-0" : ""}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium flex items-center gap-1"><User size={14} />  {t("Speakers")}</h4>
                    <Button size="sm" variant="ghost" onClick={() => { setSpeakerDialog(session.id); setEditingSpeaker(undefined) }}><Plus size={14} /> {t("Add")}</Button>
                  </div>
                  {sp.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("No speakers assigned")}</p>
                  ) : (
                    <div className="space-y-2">
                      {sp.map((speaker) => (
                        <div key={speaker.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                          <div>
                            <p className="text-sm font-medium">{speaker.name}</p>
                            {speaker.bio && <p className="text-xs text-muted-foreground">{speaker.bio}</p>}
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => { setSpeakerDialog(session.id); setEditingSpeaker(speaker) }}><Pencil size={12} /></Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                              try {
                                await deleteSpeaker(speaker.id)
                                toast.success(t("Speaker removed"))
                                fetch()
                              } catch (e: any) {
                                toast.error(localizeToast(e?.message ?? "Failed to remove speaker"))
                              }
                            }}><Trash2 size={12} /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={sessionDialog} onOpenChange={setSessionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingSession ? t("Edit Session") : t("Add Session")}</DialogTitle></DialogHeader>
          <SessionForm key={editingSession?.id ?? "new"} eventId={eventId!} session={editingSession} onClose={() => { setSessionDialog(false); fetch() }} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!speakerDialog} onOpenChange={(open) => { if (!open) setSpeakerDialog(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSpeaker ? t("Edit Speaker") : t("Add Speaker")}</DialogTitle></DialogHeader>
          {speakerDialog && (
            <SpeakerForm key={editingSpeaker?.id ?? "new"} sessionId={speakerDialog} speaker={editingSpeaker} onClose={() => { setSpeakerDialog(null); fetch() }} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

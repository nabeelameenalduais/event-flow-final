import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { runtimeFormatTime as formatTime } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { ArrowLeft, ExternalLink, Send, Video, Users, MessageSquare, Clock } from "lucide-react"
import { toast } from "sonner"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Badge } from "../components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Loading } from "../components/ui/Loading"
import { useAuth } from "../contexts/AuthContext"
import { getEventById, getRegistrations } from "../services/eventService"
import {
  buildJitsiEmbedUrl,
  buildJitsiExternalUrl,
  getJitsiRoomName,
  isEmbeddableMeeting,
  recordMeetingPresence,
  getMeetingMessages,
  sendMeetingMessage,
  subscribeToMeetingChat,
  getMyPresence,
  formatDuration,
} from "../services/meetingService"
import type { Event, MeetingChatMessage, Registration } from "../types"

const PRESENCE_INTERVAL_MS = 30_000

export function EventMeeting() {
  const { t } = useLanguage()
  
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const { profile, role, user } = useAuth()

  const [event, setEvent] = useState<Event | null>(null)
  const [registration, setRegistration] = useState<Registration | undefined>()
  const [messages, setMessages] = useState<MeetingChatMessage[]>([])
  const [messageText, setMessageText] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [presenceSeconds, setPresenceSeconds] = useState(0)
  const [attended, setAttended] = useState(false)
  const [joined, setJoined] = useState(false)
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const secondsRef = useRef(0)

  const isManager = role === "admin" || (!!event && event.organizerId === profile?.id)
  const canAttend = role === "attendee" && !!registration && registration.status === "confirmed"
  const embeddable = !!event && isEmbeddableMeeting(event)
  const room = event ? getJitsiRoomName(event) : ""

  const loadMessages = useCallback(async () => {
    if (!eventId) return
    const list = await getMeetingMessages(eventId)
    setMessages(list)
  }, [eventId])

  useEffect(() => {
    if (!eventId || !profile) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const data = await getEventById(eventId)
      if (cancelled) return
      if (!data) {
        navigate("/dashboard")
        return
      }
      setEvent(data)
      const regs = await getRegistrations(eventId)
      const mine = regs.find((r) => r.attendeeId === profile.id && r.status !== "cancelled")
      setRegistration(mine)
      if (mine) {
        const presence = await getMyPresence(eventId, profile.id)
        if (presence) {
          setPresenceSeconds(presence.totalSeconds)
          secondsRef.current = presence.totalSeconds
          setAttended(presence.attended)
        }
      }
      setLoading(false)
    })().catch(() => {
      toast.error(t("Could not load the meeting"))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [eventId, profile, navigate, t])

  useEffect(() => {
    if (!eventId) return
    loadMessages().catch(() => undefined)
    const unsubscribe = subscribeToMeetingChat(eventId, () => {
      loadMessages().catch(() => undefined)
    })
    return unsubscribe
  }, [eventId, loadMessages])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Presence accumulates only while the meeting page is open and visible.
  useEffect(() => {
    if (!eventId || !profile || !user || !canAttend || !joined) return
    const flush = async (seconds: number) => {
      if (seconds <= 0) return
      try {
        const result = await recordMeetingPresence(eventId, profile.id, user.id, seconds, true)
        secondsRef.current = result.totalSeconds
        setPresenceSeconds(result.totalSeconds)
        if (result.attended && !attended) {
          setAttended(true)
          toast.success(t("Attendance recorded automatically"))
        }
      } catch {
        // best-effort
      }
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      flush(Math.round(PRESENCE_INTERVAL_MS / 1000)).catch(() => undefined)
    }, PRESENCE_INTERVAL_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [eventId, profile, user, canAttend, joined, attended, t])

  const handleJoin = () => {
    if (!event) return
    setJoined(true)
    if (!embeddable) {
      window.open(event.meetingLink || buildJitsiExternalUrl(room), "_blank", "noopener,noreferrer")
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventId || !user || !messageText.trim()) return
    setSending(true)
    try {
      await sendMeetingMessage(eventId, user.id, messageText)
      setMessageText("")
      await loadMessages()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to send the message"))
    } finally {
      setSending(false)
    }
  }

  if (loading) return <Loading text={t("Loading meeting...")} />

  if (!event) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Video size={48} className="mx-auto mb-4 opacity-30" />
        <p>{t("Event not found.")}</p>
      </div>
    )
  }

  if (!isManager && !canAttend) {
    return (
      <div className="max-w-lg mx-auto text-center py-20 space-y-4">
        <Video size={48} className="mx-auto text-muted-foreground opacity-40" />
        <h1 className="text-xl font-semibold">{t("Meeting access is restricted")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("Only confirmed attendees, the organizer and administrators can join this meeting.")}
        </p>
        <Button onClick={() => navigate(`/events/${event.id}`)}>{t("Back to event")}</Button>
      </div>
    )
  }

  const displayName = `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim()
  const embedUrl = buildJitsiEmbedUrl(room, displayName, event.meetingLink)
  const externalUrl = event.meetingLink || buildJitsiExternalUrl(room)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/events/${event.id}`)} className="gap-2">
            <ArrowLeft size={16} /> {t("Event")}
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{event.title}</h1>
            <p className="text-sm text-muted-foreground">
              {embeddable ? t("Jitsi meeting embedded in EventFlow") : t("External meeting")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canAttend && (
            <Badge variant={attended ? "default" : "outline"} className="gap-1">
              <Clock size={12} /> {formatDuration(presenceSeconds)} {t("in meeting")}
            </Badge>
          )}
          <Button variant="outline" className="gap-2" onClick={() => window.open(externalUrl, "_blank", "noopener,noreferrer")}>
            <ExternalLink size={16} /> {t("Open in new tab")}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {embeddable ? (
              joined ? (
                <iframe
                  title={t("Event meeting")}
                  src={embedUrl}
                  allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
                  className="w-full border-0"
                  style={{ height: "70vh", minHeight: 480 }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 py-24 px-6 text-center bg-muted/30" style={{ minHeight: 480 }}>
                  <Video size={56} className="text-primary opacity-70" />
                  <div>
                    <h2 className="text-lg font-semibold">{t("Ready to join?")}</h2>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                      {t("The meeting runs inside EventFlow. Your attendance time is counted only while this page is visible.")}
                    </p>
                  </div>
                  <Button className="gap-2 bg-gradient-to-r from-teal-500 to-amber-500 text-white" onClick={handleJoin}>
                    <Video size={16} /> {t("Join meeting")}
                  </Button>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 py-24 px-6 text-center bg-muted/30" style={{ minHeight: 480 }}>
                <ExternalLink size={48} className="text-primary opacity-70" />
                <div>
                  <h2 className="text-lg font-semibold">{t("This meeting opens in a new tab")}</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    {t("Only Jitsi links can be embedded. Other providers open externally; in-meeting chat is still saved here.")}
                  </p>
                </div>
                <Button className="gap-2" onClick={handleJoin}>
                  <ExternalLink size={16} /> {t("Open meeting")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col" style={{ maxHeight: "70vh" }}>
          <CardHeader className="py-3 border-b border-border">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare size={16} /> {t("In-meeting chat")}
              <Badge variant="secondary" className="ml-auto">{messages.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">{t("No messages yet. Say hello.")}</p>
            ) : (
              messages.map((message) => {
  
                const mine = message.senderId === user?.id
                return (
                  <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {!mine && <p className="text-[11px] font-medium opacity-70 mb-0.5">{message.senderName ?? t("User")}</p>}
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                      <p className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {formatTime(message.createdAt, { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={chatEndRef} />
          </CardContent>
          <form onSubmit={handleSend} className="flex gap-2 border-t border-border p-3">
            <Input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={t("Write a message...")}
              maxLength={2000}
            />
            <Button type="submit" size="icon" disabled={sending || !messageText.trim()}>
              <Send size={16} />
            </Button>
          </form>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Users size={14} /> {registration?.attendanceMode === "online" ? t("Online attendee") : isManager ? t("Organizer view") : t("In-person attendee")}</span>
        <span>{t("Room:")} {room}</span>
        <Link to={`/events/${event.id}`} className="text-primary hover:underline">{t("Event details")}</Link>
        {(role === "admin" || role === "organizer") && (
          <Link to={`/dashboard/events/${event.id}/attendance`} className="text-primary hover:underline">{t("Attendance report")}</Link>
        )}
      </div>
    </div>
  )
}

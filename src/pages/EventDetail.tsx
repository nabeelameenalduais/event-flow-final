import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { runtimeFormatDate as formatDate, runtimeFormatTime as formatTime } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect, useCallback } from "react"
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom"
import { Calendar, MapPin, Clock, User, Users, Loader2, Star, Sparkles, Lock, Video } from "lucide-react"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Textarea } from "../components/ui/textarea"
import { Card, CardContent } from "../components/ui/card"
import { useAuth } from "../contexts/AuthContext"
import { getEventById, getRegistrations, registerForEvent, cancelRegistration, isMeetingLinkVisible, getWaitlistInfo, type WaitlistInfo } from "../services/eventService"
import { getSessionsByEvent, getSpeakersBySession } from "../services/sessionService"
import { getFeedbackByEvent, submitFeedback } from "../services/feedbackService"
import { getProfilesByIds } from "../services/userService"
import { getVenueById } from "../services/venueService"
import { getLinkByCode } from "../services/invitationService"
import type { Event, Session, Speaker, Registration, Feedback, Venue, AttendanceMode } from "../types"

export function EventDetail() {
  const { t, tp } = useLanguage()
  
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const code = searchParams.get("code")
  const { isAuthenticated, profile, role, user } = useAuth()
  const [event, setEvent] = useState<Event | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [validCode, setValidCode] = useState<string | undefined>()
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [speakersMap, setSpeakersMap] = useState<Record<string, Speaker[]>>({})
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [myRegistration, setMyRegistration] = useState<Registration | undefined>()
  const [registering, setRegistering] = useState(false)
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([])
  const [profileMap, setProfileMap] = useState<Map<string, any>>(new Map())
  const [venue, setVenue] = useState<Venue | undefined>()
  const [rating, setRating] = useState(5)
  const [review, setReview] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [attendanceMode, setAttendanceMode] = useState<AttendanceMode>("in_person")
  const [waitlistInfo, setWaitlistInfo] = useState<WaitlistInfo | null>(null)

  const fetchData = useCallback(async () => {
    if (!id) return
    const data = await getEventById(id)
    if (data && data.visibility === "private") {
      if (!code) {
        setLoading(false)
        return
      }
      const link = await getLinkByCode(code)
      if (!link || link.eventId !== data.id) {
        setLinkError("Invalid invitation link")
        setLoading(false)
        return
      }
      if (link.used) {
        setLinkError("This invitation link has already been used")
        setLoading(false)
        return
      }
      setValidCode(code)
      setInvitedEmail(link.email)
    }
    setEvent(data ?? null)
    if (data) {
      const [sess, regs, fb] = await Promise.all([getSessionsByEvent(data.id), getRegistrations(data.id), getFeedbackByEvent(data.id)])
      setSessions(sess)
      setRegistrations(regs)
      setFeedbackList(fb)
      const venueData = data.venueId ? await getVenueById(data.venueId) : undefined
      setVenue(venueData)
      const attendeeIds = [...new Set(fb.map((f) => f.attendeeId))]
      if (attendeeIds.length > 0) {
        const profs = await getProfilesByIds(attendeeIds)
        setProfileMap(new Map(profs.map((p: any) => [p.id, p])))
      }
      const map: Record<string, Speaker[]> = {}
      for (const s of sess) { map[s.id] = await getSpeakersBySession(s.id) }
      setSpeakersMap(map)
      if (profile) {
        const mine = regs.find((r) => r.attendeeId === profile.id && r.status !== "cancelled")
        setMyRegistration(mine)
        setAttendanceMode(mine?.attendanceMode ?? (data.eventType === "online" ? "online" : "in_person"))
        if (mine?.status === "waitlisted") {
          const info = await getWaitlistInfo(data.id, mine.id).catch(() => null)
          setWaitlistInfo(info)
        } else {
          setWaitlistInfo(null)
        }
      }
    }
    setLoading(false)
  }, [id, profile, code])

  useEffect(() => { fetchData() }, [fetchData])

  const handleRegister = async () => {
    if (!id || !profile) return
    setRegistering(true)
    try {
      const result = await registerForEvent(
        id,
        profile.id,
        validCode,
        event?.eventType === "hybrid" ? attendanceMode : undefined,
      )
      if (result.waitlisted) {
        const position = result.waitlistPosition ?? result.waitlistInfo?.position
        toast.success(
          localizeToast(position
            ? `Event is full — you are number ${position} on the waiting list.`
            : "Event is full — you've been added to the waiting list!"),
        )
      } else {
        toast.success(t("Successfully registered! Check your dashboard for tickets."))
      }
      fetchData()
    } catch (err: any) {
      toast.error(localizeToast(err.message ?? "Registration failed"))
    } finally {
      setRegistering(false)
    }
  }

  const handleCancel = async () => {
    if (!myRegistration) return
    setRegistering(true)
    try {
      await cancelRegistration(myRegistration.id)
      toast.success(t("Registration cancelled"))
      fetchData()
    } catch {
      toast.error(t("Failed to cancel"))
    } finally {
      setRegistering(false)
    }
  }

  const handleSubmitReview = async () => {
    if (!id || !profile || !review.trim()) return
    setSubmitting(true)
    try {
      await submitFeedback({ eventId: id, attendeeId: profile.id, rating, comment: review.trim(), submittedAt: new Date().toISOString() })
      toast.success(t("Review submitted!"))
      setReview("")
      setRating(5)
      const fb = await getFeedbackByEvent(id)
      setFeedbackList(fb)
    } catch (e: any) {
      toast.error(localizeToast(e.message ?? "Failed to submit review"))
    } finally {
      setSubmitting(false)
    }
  }

  const avgRating = feedbackList.length > 0
    ? (feedbackList.reduce((s, f) => s + f.rating, 0) / feedbackList.length).toFixed(1)
    : null

  const hasSubmitted = profile ? feedbackList.some((f) => f.attendeeId === profile.id) : false
  const canReview = profile && myRegistration && myRegistration.status === "confirmed" && !hasSubmitted

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary/20 border-t-primary" /></div>
  if (!event || linkError) return (
    <div className="text-center py-20 text-muted-foreground">
      <Lock size={48} className="mx-auto mb-4 opacity-30" />
      <p className="text-lg font-medium">{linkError ?? t("Event not found")}</p>
      <p className="text-sm mt-2">{t("This event is private and requires a valid invitation link to access.")}</p>
    </div>
  )

  const emailMismatch = !!(event.visibility === "private" && invitedEmail && user && user.email !== invitedEmail)

  const isHybrid = event.eventType === "hybrid"
  const confirmedAll = registrations.filter((r) => r.status === "confirmed")
  const confirmedForMode = isHybrid
    ? confirmedAll.filter((r) => (r.attendanceMode ?? "in_person") === attendanceMode)
    : confirmedAll
  const modeCapacity = isHybrid
    ? attendanceMode === "online"
      ? event.onlineCapacity ?? event.capacity
      : event.inPersonCapacity ?? event.capacity
    : event.eventType === "online"
      ? event.onlineCapacity ?? event.capacity
      : event.inPersonCapacity ?? event.capacity
  const confirmedCount = confirmedAll.length
  const spotsLeft = Math.max(0, modeCapacity - confirmedForMode.length)
  const canJoinOnline = !!myRegistration && myRegistration.status === "confirmed" &&
    (event.eventType === "online" || myRegistration.attendanceMode === "online")

  return (
    <div className="relative max-w-4xl mx-auto px-4 py-12">
      <div className="absolute top-20 left-0 w-72 h-72 bg-teal-500/12 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-40 left-1/3 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-1/4 w-56 h-56 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative animate-fade-in-up">
        <div className="relative h-64 rounded-xl overflow-hidden mb-8 bg-gradient-to-br from-teal-500/30 via-amber-500/20 to-emerald-500/20 flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
          <div className="absolute top-5 right-5 flex items-center gap-2">
            {event.visibility === "private" && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 backdrop-blur-sm text-xs font-medium border border-amber-500/30 text-amber-600 dark:text-amber-400">
                <Lock size={14} />
                {t("Private Event")}
              </div>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/70 dark:bg-background/70 backdrop-blur-sm text-xs font-medium border border-border/50">
              <Sparkles size={14} className="text-primary" />
              {t("Featured Event")}
            </div>
          </div>
          <Calendar size={64} className="text-foreground/15 relative" />
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start gap-8">
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-4">{event.title}</h1>
            {event.visibility === "private" && invitedEmail && (
              <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2">
                <Lock size={14} className="text-amber-500" />
                {t("Invitation for")} <strong>{invitedEmail}</strong>
              </div>
            )}
            <div className="flex flex-wrap gap-4 mb-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Calendar size={16} className="text-teal-500" />{formatDate(event.startDate)} - {formatDate(event.endDate)}</span>
              <span className="flex items-center gap-1.5"><MapPin size={16} className="text-teal-500" />{event.eventType === "online" ? t("Online event") : isHybrid ? `Hybrid — ${venue?.name ?? t("venue TBA")} + online` : (venue?.name ?? t("Unknown venue"))}</span>
              <span className="flex items-center gap-1.5"><Users size={16} className="text-teal-500" />{isHybrid ? t("{confirmed}/{capacity} {mode} seats", { confirmed: confirmedForMode.length, capacity: modeCapacity, mode: t(attendanceMode === "online" ? "online" : "in_person") }) : t("{confirmed}/{capacity} registered", { confirmed: confirmedCount, capacity: modeCapacity })}</span>
            </div>
            {spotsLeft > 0 && spotsLeft <= 10 && (
              <Badge variant="destructive" className="mb-4">{tp("Only {count} spot left!", "Only {count} spots left!", spotsLeft)}</Badge>
            )}
          </div>

          <div className="lg:w-72 w-full">
            <div className="rounded-xl bg-gradient-to-br from-teal-500/10 via-amber-500/10 to-emerald-500/10 p-0.5 shadow-lg shadow-teal-500/10">
              <div className="rounded-[11px] bg-white/90 dark:bg-card/90 backdrop-blur-sm p-6">
                {!isAuthenticated ? (
                  <div className="text-center space-y-3">
                    <p className="text-sm text-muted-foreground">{t("Login to register for this event")}</p>
                    <Link to="/login" className="block w-full bg-gradient-to-r from-teal-500 via-amber-500 to-emerald-500 text-white py-2 rounded-lg text-sm font-medium text-center hover:opacity-90 transition-opacity shadow-md">{t("Login")}</Link>
                  </div>
                  ) : role === "attendee" ? (
                  emailMismatch ? (
                    <div className="text-center space-y-2">
                      <Lock size={24} className="mx-auto text-destructive opacity-60" />
                      <p className="text-sm text-destructive font-medium">{t("Wrong account")}</p>
                      <p className="text-xs text-muted-foreground">{t("This invitation was sent to")} <strong>{invitedEmail}</strong>{t(". You are logged in as")} <strong>{user?.email}</strong>.</p>
                    </div>
                  ) : new Date(event.endDate) < new Date() ? (
                    <p className="text-sm text-muted-foreground text-center">{t("Event has ended")}</p>
                  ) : (
                    <div className="space-y-3">
                      {myRegistration ? (
                        <div className="space-y-3">
                          <Badge variant={myRegistration.status === "confirmed" ? "default" : "secondary"} className="w-full justify-center py-1.5 text-sm">
                            {myRegistration.status === "confirmed" ? t("✓ Registered") : myRegistration.status === "waitlisted" ? t("⏳ On Waiting List") : myRegistration.status}
                          </Badge>
                          {isHybrid && myRegistration.attendanceMode && (
                            <p className="text-xs text-muted-foreground text-center">
                              {t("Attendance mode:")} <strong className="text-foreground">{myRegistration.attendanceMode === "online" ? "Online" : t("In person")}</strong>
                            </p>
                          )}
                          {myRegistration.status === "waitlisted" && waitlistInfo && (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs space-y-1">
                              <p>{t("Position")} <strong>#{waitlistInfo.position}</strong> {t("of")} {waitlistInfo.waitlistTotal}</p>
                              <p>{waitlistInfo.ahead} {t("ahead of you")}</p>
                              <p>{tp("{count} seat available now", "{count} seats available now", waitlistInfo.availableSeats)}</p>
                            </div>
                          )}
                          <Button variant="outline" className="w-full text-destructive" onClick={handleCancel} disabled={registering}>
                            {registering ? <Loader2 size={16} className="animate-spin" /> : null}
                            {t("Cancel Registration")}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {isHybrid && (
                            <div>
                              <p className="text-xs font-medium mb-1.5">{t("Attendance mode")}</p>
                              <div className="grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => setAttendanceMode("in_person")}
                                  className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors ${attendanceMode === "in_person" ? "border-primary bg-primary/10 text-primary" : "border-input bg-background text-muted-foreground"}`}>
                                  {t("In person")}
                                </button>
                                <button type="button" onClick={() => setAttendanceMode("online")}
                                  className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors ${attendanceMode === "online" ? "border-primary bg-primary/10 text-primary" : "border-input bg-background text-muted-foreground"}`}>
                                  
                                  {t("Online")}
                                </button>
                              </div>
                            </div>
                          )}
                          <div className="text-center mb-2">
                            <p className="text-2xl font-bold">{spotsLeft}</p>
                            <p className="text-xs text-muted-foreground">
                              {isHybrid ? t("{mode} spots remaining", { mode: t(attendanceMode === "online" ? "online" : "in_person") }) : t("spots remaining")}
                            </p>
                          </div>
                          <Button className="w-full bg-gradient-to-r from-teal-500 via-amber-500 to-emerald-500 text-white shadow-md shadow-teal-500/20" onClick={handleRegister} disabled={registering}>
                            {registering ? <Loader2 size={16} className="animate-spin" /> : null}
                            {spotsLeft <= 0 ? t("Join Waiting List") : t("Register Now")}
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground text-center">{role === "admin" ? t("Admins cannot register for events") : t("Organizers cannot register for events")}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {(event.eventType === "online" || event.eventType === "hybrid") && isMeetingLinkVisible(event) && canJoinOnline && (
          <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="p-3 rounded-lg bg-primary/15 text-primary">
                <Video size={22} />
              </div>
              <div>
                <p className="font-semibold">{event.eventType === "hybrid" ? t("Online Meeting Room") : t("Online Meeting")}</p>
                <p className="text-sm text-muted-foreground">
                  {event.meetingProvider === "external"
                    ? t("This meeting opens in a new tab from the meeting page.")
                    : t("The Jitsi room is embedded in EventFlow, with attendance and in-meeting chat.")}
                </p>
              </div>
            </div>
            <Button className="gap-2 bg-gradient-to-r from-teal-500 to-amber-500 text-white" onClick={() => navigate(`/dashboard/events/${event.id}/meeting`)}>
              <Video size={16} /> {t("Open meeting room")}
            </Button>
          </div>
        )}

        {(event.eventType === "online" || event.eventType === "hybrid") && !isMeetingLinkVisible(event) && canJoinOnline && (
          <div className="mt-6 rounded-xl border border-border bg-muted/30 p-5 flex items-center gap-3">
            <Video size={20} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {t("The meeting room will be available here one hour before the event starts. Only registered attendees can join.")}
            </p>
          </div>
        )}

        {spotsLeft <= 0 && !myRegistration && (
          <div className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-5">
            <p className="font-semibold text-amber-700 dark:text-amber-400">{t("Capacity is full")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {isHybrid
                ? t("All {mode} seats are taken. You can join that waiting list or switch the attendance mode above.", { mode: t(attendanceMode === "online" ? "online" : "in_person") })
                : t("All seats are taken. You can still join the waiting list — you'll be notified automatically if a spot opens up.")}
            </p>
          </div>
        )}

        <Tabs defaultValue="about" className="mt-8">
          <TabsList>
            <TabsTrigger value="about">{t("About")}</TabsTrigger>
            {sessions.length > 0 && <TabsTrigger value="schedule">{t("Schedule (")}{sessions.length})</TabsTrigger>}
            <TabsTrigger value="reviews">{t("Reviews (")}{feedbackList.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="about" className="mt-6">
            <p className="text-muted-foreground leading-relaxed">{event.description}</p>
            {isHybrid && event.hybridNote && (
              <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">{t("Hybrid attendance")}</p>
                <p className="text-sm text-muted-foreground">{event.hybridNote}</p>
              </div>
            )}
          </TabsContent>
          {sessions.length > 0 && (
            <TabsContent value="schedule" className="mt-6 space-y-4">
              {sessions.map((session) => {
                const sp = speakersMap[session.id] ?? []
                return (
                  <div key={session.id} className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{session.title}</h3>
                        <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {formatTime(session.startTime, { hour: '2-digit', minute: '2-digit' })}
                            {" — "}
                            {formatTime(session.endTime, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="flex items-center gap-1"><MapPin size={14} /> {session.roomName}</span>
                        </div>
                      </div>
                    </div>
                    {session.description && <p className="mt-3 text-sm text-muted-foreground">{session.description}</p>}
                    {sp.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">{t("Speakers")}</p>
                        <div className="flex flex-wrap gap-3">
                          {sp.map((speaker) => (
                            <Badge key={speaker.id} variant="secondary" className="gap-1">
                              <User size={12} /> {speaker.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </TabsContent>
          )}
          <TabsContent value="reviews" className="mt-6 space-y-6">
            {avgRating && (
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-rose-500/15 rounded-lg border border-amber-500/20">
                <Star size={28} className="text-amber-500 fill-amber-500" />
                <span className="text-2xl font-bold">{avgRating}</span>
                <span className="text-sm text-muted-foreground">({tp("{count} review", "{count} reviews", feedbackList.length)})</span>
              </div>
            )}

            {canReview && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h4 className="font-medium">{t("Write a Review")}</h4>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={() => setRating(n)} className="p-0.5">
                        <Star size={20} className={n <= rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground"} />
                      </button>
                    ))}
                  </div>
                  <Textarea placeholder={t("Share your experience...")} value={review} onChange={(e) => setReview(e.target.value)} rows={3} />
                  <Button size="sm" onClick={handleSubmitReview} disabled={submitting || !review.trim()}>
                    {submitting ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                    {t("Submit Review")}
                  </Button>
                </CardContent>
              </Card>
            )}

            {feedbackList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t("No reviews yet.")}</p>
            ) : (
              <div className="space-y-4">
                {feedbackList.map((fb) => {
                  const attendee = profileMap.get(fb.attendeeId)
                  return (
                    <div key={fb.id} className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center text-xs font-medium">
                            {attendee?.firstName?.[0]}{attendee?.lastName?.[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{attendee?.firstName} {attendee?.lastName}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(fb.submittedAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} size={14} className={i < fb.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"} />
                          ))}
                        </div>
                      </div>
                      <p className="mt-3 text-sm">{fb.comment}</p>
                      {fb.response && (
                        <div className="mt-3 pl-4 border-l-2 border-primary/30">
                          <p className="text-xs font-medium text-primary">{t("Organizer response")}</p>
                          <p className="text-sm text-muted-foreground mt-1">{fb.response}</p>
                          <p className="text-xs text-muted-foreground mt-1">{fb.respondedAt ? formatDate(fb.respondedAt) : ""}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

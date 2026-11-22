import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { runtimeFormatTime as formatTime } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Send, Users, UserCircle, Loader2, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import { cn } from "../lib/utils"
import { Input } from "../components/ui/input"
import { Button } from "../components/ui/button"
import { Loading } from "../components/ui/Loading"
import { useAuth } from "../contexts/AuthContext"
import { getEventById } from "../services/eventService"
import {
  getChannelsForUser, getMessages, sendMessage, subscribeToChannel,
  type ChatChannelInfo,
} from "../services/chatService"
import type { ChatMessageWithSender } from "../types"

const POLL_INTERVAL = 5000

export function EventChat() {
  const { t } = useLanguage()
  
  const { eventId } = useParams<{ eventId: string }>()
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const [eventTitle, setEventTitle] = useState("")
  const [channels, setChannels] = useState<ChatChannelInfo[]>([])
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessageWithSender[]>([])
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const seenRef = useRef<Set<string>>(new Set())

  const loadMessages = useCallback(async (channelId: string) => {
  
    try {
      const msgs = await getMessages(channelId, { userId: user?.id ?? "", attendeeProfileId: profile?.id })
      const newOnes = msgs.filter((m) => m.senderId !== user?.id && !seenRef.current.has(m.id))
      for (const m of newOnes) seenRef.current.add(m.id)
      setMessages(msgs)
      setError(null)
    } catch (e: any) {
      setError(e.message ?? t("Could not load messages"))
    }
  }, [user?.id, profile?.id, t])

  const fetch = useCallback(async () => {
  
    if (!eventId || !profile) return
    try {
      const event = await getEventById(eventId)
      if (!event) { navigate("/dashboard/events"); return }
      setEventTitle(event.title)

      const chans = await getChannelsForUser(eventId, user?.id ?? "", profile.id)
      setChannels(chans)
      if (chans.length > 0) {
        const target = activeChannelId ?? chans[0].id
        const exists = chans.some((c) => c.id === target)
        const selected = exists ? target : chans[0].id
        setActiveChannelId(selected)
        await loadMessages(selected)
      }
      setError(null)
    } catch (e: any) {
      setError(e.message ?? t("Could not load the chat"))
    } finally {
      setLoading(false)
    }
  }, [eventId, profile, user?.id, activeChannelId, loadMessages, navigate, t])

  useEffect(() => { fetch() }, [fetch])

  // Periodic polling (fallback for when Realtime is unavailable)
  useEffect(() => {
    if (!activeChannelId) return
    const timer = setInterval(() => {
      loadMessages(activeChannelId).catch(() => {})
    }, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [activeChannelId, loadMessages])

  // Realtime subscription
  useEffect(() => {
    if (!activeChannelId) return
    const sub = subscribeToChannel(activeChannelId, (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        loadMessages(activeChannelId).catch(() => {})
        return prev
      })
    }, (status) => {
      setRealtimeStatus(status)
    })
    return () => { sub.unsubscribe() }
  }, [activeChannelId, loadMessages])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    if (!activeChannelId || !draft.trim()) return
    setSending(true)
    try {
      await sendMessage(activeChannelId, user?.id ?? "", draft)
      setDraft("")
      await loadMessages(activeChannelId)
    } catch (e: any) {
      toast.error(localizeToast(e.message ?? "Failed to send message"))
    } finally {
      setSending(false)
    }
  }

  if (loading) return <Loading text={t("Loading chat...")} />

  const activeChannel = channels.find((c) => c.id === activeChannelId)

  const realtimeOk = realtimeStatus === "SUBSCRIBED"

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/events")} className="gap-2">
            <ArrowLeft size={16} /> {t("Events")}
          </Button>
          <h1 className="text-xl font-bold">{t("Chat ·")} {eventTitle}</h1>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={`inline-block w-2 h-2 rounded-full ${realtimeOk ? "bg-green-500" : "bg-amber-500"}`} />
          {realtimeOk ? t("Live") : t("Polling")}
        </span>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5">
          <p className="text-sm text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={() => { if (activeChannelId) loadMessages(activeChannelId) }}>
            {t("Retry")}
          </Button>
        </div>
      )}

      <div className="flex flex-1 min-h-0 rounded-xl border border-border bg-card overflow-hidden">
        {/* Channel list */}
        <aside className="w-64 border-r border-border flex flex-col bg-muted/30 overflow-y-auto">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("Channels")}</p>
          </div>
          {channels.map((c) => (
            <button
              key={c.id}
              onClick={() => { setActiveChannelId(c.id); loadMessages(c.id) }}
              className={cn(
                "flex items-start gap-2.5 px-4 py-3 text-left transition-colors border-b border-border/60 hover:bg-accent/50",
                activeChannelId === c.id && "bg-primary/5",
              )}
            >
              <div className={cn(
                "mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                c.channelType === "general" ? "bg-teal-500/15 text-teal-600 dark:text-teal-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
              )}>
                {c.channelType === "general" ? <Users size={15} /> : <UserCircle size={15} />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{c.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">{c.subtitle}</p>
              </div>
            </button>
          ))}
        </aside>

        {/* Messages */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-3 border-b border-border bg-muted/20">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              {activeChannel?.channelType === "general" ? <Users size={15} /> : <MessageSquare size={15} />}
              {activeChannel?.title}
            </h3>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">{t("No messages yet. Start the conversation!")}</p>
            ) : (
              messages.map((m) => {
                const mine = m.senderId === user?.id
                return (
                  <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                    <div className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                      mine
                        ? "bg-gradient-to-br from-teal-500 to-amber-500 text-white rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md",
                    )}>
                      {!mine && (
                        <p className="text-[11px] font-semibold mb-0.5 text-primary">{m.senderName}</p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatTime(m.createdAt, { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                )
              })
            )}
          </div>

          <div className="p-3 border-t border-border flex gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={t("Type a message...")}
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={sending || !draft.trim()} className="gap-2">
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {t("Send")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Bell, Mail, MailOpen, Trash2, CheckCheck, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs"
import { useAuth } from "../contexts/AuthContext"
import {
  getNotifications, markAsRead, markAllAsRead, deleteNotification,
} from "../services/notificationService"
import type { Notification } from "../types"

const typeColors: Record<string, "default" | "secondary" | "outline" | "destructive" | "success" | "warning"> = {
  registration_confirmation: "success",
  event_reminder: "warning",
  event_update: "secondary",
  check_in: "default",
}

export function Notifications() {
  const { t, localizeError, formatDateTime } = useLanguage()
  
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    try {
      const data = await getNotifications(profile.userId)
      setNotifs(data)
    } catch {
      toast.error(t("Could not load notifications"))
    } finally {
      setLoading(false)
    }
  }, [profile, t])

  useEffect(() => { fetch() }, [fetch])

  const handleOpen = async (n: Notification) => {
    if (!n.readAt) {
      await markAsRead(n.id).catch(() => {})
      setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)))
    }
    if (n.link) navigate(n.link)
  }

  const handleMarkRead = async (id: string) => {
    await markAsRead(id)
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)))
  }

  const handleMarkAllRead = async () => {
    if (!profile) return
    await markAllAsRead(profile.userId)
    setNotifs((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })))
    toast.success(t("All marked as read"))
  }

  const handleDelete = async (id: string) => {
    await deleteNotification(id)
    setNotifs((prev) => prev.filter((n) => n.id !== id))
  }

  const unread = notifs.filter((n) => !n.readAt)
  const read = notifs.filter((n) => n.readAt)

  if (loading) return <Loading text={t("Loading notifications...")} />

  return (
    <div className="relative space-y-6 animate-fade-in-up">
      <div className="absolute -top-10 -right-10 w-64 h-64 bg-teal-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-56 h-56 bg-amber-500/6 rounded-full blur-3xl pointer-events-none" />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("Notifications")}</h1>
        <div className="flex gap-2">
          {unread.length > 0 && (
            <Button size="sm" variant="ghost" onClick={handleMarkAllRead} className="gap-2">
              <CheckCheck size={14} /> {t("Mark All Read")}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">{t("All (")}{notifs.length})</TabsTrigger>
          <TabsTrigger value="unread">{t("Unread (")}{unread.length})</TabsTrigger>
          <TabsTrigger value="read">{t("Read (")}{read.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          {renderList(notifs, handleMarkRead, handleDelete, handleOpen, t, localizeError, formatDateTime)}
        </TabsContent>
        <TabsContent value="unread" className="mt-4">
          {renderList(unread, handleMarkRead, handleDelete, handleOpen, t, localizeError, formatDateTime)}
        </TabsContent>
        <TabsContent value="read" className="mt-4">
          {renderList(read, handleMarkRead, handleDelete, handleOpen, t, localizeError, formatDateTime)}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function renderList(
  items: Notification[],
  onMarkRead: (id: string) => void,
  onDelete: (id: string) => void,
  onOpen: (n: Notification) => void,
  t: (key: string) => string,
  localizeError: (message: unknown) => string,
  formatDateTime: (value: string | number | Date) => string,
) {
  if (items.length === 0) return <EmptyState title={t("No notifications")} description={t("You're all caught up!")} icon={<Bell />} />

  return (
    <div className="space-y-2">
      {items.map((n) => (
        <div
          key={n.id}
          onClick={() => onOpen(n)}
          className={`flex items-start gap-3 p-4 rounded-lg border border-border transition-colors ${
            n.link ? "cursor-pointer hover:bg-accent/50" : ""
          } ${!n.readAt ? "bg-primary/5 border-primary/20 shadow-sm" : ""}`}
        >
          <div className="mt-0.5">
            {n.readAt ? <MailOpen size={18} className="text-muted-foreground" /> : <Mail size={18} className="text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm ${!n.readAt ? "font-medium" : ""}`}>{localizeError(n.message)}</p>
              <Badge variant={typeColors[n.type] ?? "outline"} className="text-[10px] px-1.5 capitalize">{localizeError(n.type.replace(/_/g, " "))}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{formatDateTime(n.createdAt)}</p>
          </div>
          <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {n.link && (
              <Button size="icon" variant="ghost" className="h-8 w-8" title={t("Open")} onClick={() => onOpen(n)}>
                <ExternalLink size={14} />
              </Button>
            )}
            {!n.readAt && (
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onMarkRead(n.id)} title={t("Mark as read")}>
                <CheckCheck size={14} />
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => onDelete(n.id)} title={t("Delete")}>
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

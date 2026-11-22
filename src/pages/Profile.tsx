import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { runtimeFormatDate as formatDate, runtimeFormatDateTime as formatDateTime } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { toast } from "sonner"
import { Monitor, Smartphone, Laptop, Globe, Trash2, LogOut, ShieldAlert, FileDown } from "lucide-react"
import { Avatar, AvatarFallback } from "../components/ui/avatar"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { updateUser } from "../services/userService"
import { setOrganizerAllEvents } from "../services/organizerService"
import { getDeviceSessions, deleteDeviceSession, deleteAllDeviceSessions, type SessionListItem } from "../services/deviceSessionService"
import { requestAccountDeletion, getAnonymizedAccountReport } from "../services/accountService"
import { DEFAULT_ACCOUNT_DELETION_GRACE_DAYS } from "../constants"
import { SESSION_KEY } from "../lib/session"

function deviceIcon(name: string) {
  const n = name.toLowerCase()
  if (n.includes("android") || n.includes("iphone") || n.includes("ipad") || n.includes("ios")) return <Smartphone size={16} />
  if (n.includes("windows")) return <Monitor size={16} />
  if (n.includes("mac")) return <Laptop size={16} />
  return <Globe size={16} />
}

export function Profile() {
  const { t } = useLanguage()
  
  const { user, profile, role, refreshProfile, logout } = useAuth()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState(profile?.firstName ?? "")
  const [lastName, setLastName] = useState(profile?.lastName ?? "")
  const [phone, setPhone] = useState(profile?.phoneNumber ?? "")
  const [managesAll, setManagesAll] = useState(profile?.managesAllEvents ?? false)
  const [saving, setSaving] = useState(false)
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [revokingAll, setRevokingAll] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [downloadingReport, setDownloadingReport] = useState(false)

  const initials = `${profile?.firstName?.[0] ?? ""}${profile?.lastName?.[0] ?? ""}`

  const loadSessions = useCallback(async () => {
    if (!user) return
    try {
      const token = localStorage.getItem(SESSION_KEY) ?? ""
      const list = await getDeviceSessions(user.id, token)
      setSessions(list)
    } catch {
      toast.error(t("Could not load active sessions"))
    } finally {
      setSessionsLoading(false)
    }
  }, [user, t])

  useEffect(() => { loadSessions() }, [loadSessions])

  const handleRevoke = async (id: string) => {
    if (!user) return
    setRevokingId(id)
    try {
      await deleteDeviceSession(user.id, id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
      toast.success(t("Session signed out"))
    } catch {
      toast.error(t("Failed to sign out that session"))
    } finally {
      setRevokingId(null)
    }
  }

  const handleRevokeAll = async () => {
    if (!user) return
    setRevokingAll(true)
    try {
      const token = localStorage.getItem(SESSION_KEY) ?? ""
      const count = await deleteAllDeviceSessions(user.id, token)
      setSessions((prev) => prev.filter((s) => s.isCurrent))
      toast.success(localizeToast(count > 0 ? `Signed out ${count} other session${count === 1 ? "" : "s"}` : "No other sessions to sign out"))
    } catch {
      toast.error(t("Failed to sign out other sessions"))
    } finally {
      setRevokingAll(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    try {
      await updateUser(user.id, { firstName, lastName, phoneNumber: phone })
      await refreshProfile()
      toast.success(t("Profile updated"))
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to update profile"))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleAllEvents = async (checked: boolean) => {
    if (!user || role !== "admin") return
    setManagesAll(checked)
    try {
      await setOrganizerAllEvents(user.id, checked)
      await refreshProfile()
      toast.success(localizeToast(checked ? "You now manage all events" : "All-events management disabled"))
    } catch {
      setManagesAll(!checked)
      toast.error(t("Failed to update setting"))
    }
  }

  const handleDownloadReport = async () => {
    if (!user || !profile) return
    setDownloadingReport(true)
    try {
      const report = await getAnonymizedAccountReport(profile.id, user.id)
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = `eventflow-anonymized-activity-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(link.href)
      toast.success(t("Anonymized activity report downloaded"))
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to build the report"))
    } finally {
      setDownloadingReport(false)
    }
  }

  const handleDeleteAccount = async () => {
  
    if (!user) return
    const graceDays = DEFAULT_ACCOUNT_DELETION_GRACE_DAYS
    const recoveryText = graceDays > 0
      ? `all data is kept for a ${graceDays}-day recovery window. You can restore it from the login page during that window.`
      : t("all data is kept and only an administrator can restore the account.")
    if (!window.confirm(
      `Delete your account?\n\nYour account is disabled immediately and ${recoveryText} ` +
      "Organizer events are transferred to an administrator.",
    )) return
    const reason = window.prompt("Optional reason for leaving (kept for administrators):") ?? ""
    setDeleting(true)
    try {
      const result = await requestAccountDeletion({
        userId: user.id,
        profileId: profile?.id,
        email: user.email,
        reason,
      })
      toast.success(
        localizeToast(result.restoreUntil
          ? `Account disabled. You can restore it until ${formatDate(result.restoreUntil)}.`
          : "Account disabled. Contact an administrator to restore it."),
      )
      logout()
      navigate("/login")
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to delete the account"))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="relative max-w-2xl mx-auto space-y-6 animate-fade-in-up">
      <div className="absolute -top-10 -right-10 w-64 h-64 bg-teal-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-56 h-56 bg-amber-500/6 rounded-full blur-3xl pointer-events-none" />
      <h1 className="text-2xl font-bold">{t("My Profile")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("Personal Information")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
              <AvatarFallback className="text-lg bg-gradient-to-br from-primary/20 to-accent/20">{initials || "?"}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{profile?.firstName} {profile?.lastName}</p>
              <p className="text-sm text-muted-foreground capitalize">{role}</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">{t("First name")}</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">{t("Last name")}</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("Email")}</Label>
              <Input id="email" value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t("Phone")}</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button type="submit" className="bg-gradient-to-r from-primary to-[hsl(185,75%,42%)]" disabled={saving}>{saving ? t("Saving...") : t("Save changes")}</Button>
          </form>
        </CardContent>
      </Card>

      {(role === "admin" || role === "organizer") && (
        <Card>
          <CardHeader>
            <CardTitle>{t("Event Management")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t("Manage all events")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("When enabled, you'll be added as a co-organizer (with chat access) to every event automatically.")}
                  {role !== "admin" && " Only admins can change this setting."}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={managesAll}
                disabled={role !== "admin"}
                onClick={() => handleToggleAllEvents(!managesAll)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${managesAll ? "bg-primary" : "bg-input"} ${role !== "admin" ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${managesAll ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t("Active Sessions")}
            {sessions.filter((s) => !s.isCurrent).length > 0 && (
              <Button size="sm" variant="outline" className="gap-2" onClick={handleRevokeAll} disabled={revokingAll}>
                <LogOut size={14} /> {revokingAll ? t("Signing out...") : t("Sign out other devices")}
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <p className="text-sm text-muted-foreground">{t("Loading sessions...")}</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("No active sessions.")}</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">{deviceIcon(s.deviceName)}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {s.deviceName}
                        {s.isCurrent && <Badge variant="outline" className="ml-2 text-[10px]">{t("This device")}</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("Last active")} {formatDateTime(s.lastActiveAt)}
                      </p>
                    </div>
                  </div>
                  {!s.isCurrent && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-destructive"
                      disabled={revokingId === s.id}
                      onClick={() => handleRevoke(s.id)}
                    >
                      <Trash2 size={14} /> {revokingId === s.id ? "..." : t("Sign out")}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert size={18} /> {t("Danger zone")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="font-medium">{t("Delete my account")}</p>
            <p className="text-sm text-muted-foreground">
              {t("The account is disabled immediately and all data is retained for a 30-day recovery window.\n              Organizer events are transferred to an administrator first. You can restore the account from the login page\n              during the recovery window, or ask an administrator afterwards.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="gap-2" onClick={handleDownloadReport} disabled={downloadingReport}>
              <FileDown size={15} /> {downloadingReport ? "Preparing..." : t("Download anonymized activity report")}
            </Button>
            <Button type="button" variant="destructive" className="gap-2" onClick={handleDeleteAccount} disabled={deleting}>
              <Trash2 size={15} /> {deleting ? t("Deleting...") : t("Delete account")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("The anonymized report contains counts only (events, registrations, attendance, feedback, chat messages)\n            and never includes your name, email or phone number.")}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

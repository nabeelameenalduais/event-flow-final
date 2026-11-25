import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { runtimeFormatDateTime as formatDateTime, runtimeFormatDate as formatDate } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect, useCallback } from "react"
import { KeyRound, RefreshCw, Copy, Check, ShieldCheck, UserCog, XCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Badge } from "../components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { useAuth } from "../contexts/AuthContext"
import {
  getPasswordResetRequests,
  resolvePasswordResetRequest,
  rejectPasswordResetRequest,
  generateStrongPassword,
  adminSetPassword,
} from "../services/passwordResetService"
import { getUsers } from "../services/userService"
import type { PasswordResetRequestItem } from "../types"

export function PasswordResets() {
  const { t } = useLanguage()
  
  const { user } = useAuth()
  const [requests, setRequests] = useState<PasswordResetRequestItem[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [resolving, setResolving] = useState<PasswordResetRequestItem | null>(null)
  const [filter, setFilter] = useState<"pending" | "all">("pending")

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [rows, userRows] = await Promise.all([
        getPasswordResetRequests(),
        getUsers({ pageSize: 500 }),
      ])
      setRequests(rows)
      setUsers(userRows.items.filter((u) => !u.deletedAt))
    } catch (err) {
      setLoadError(true)
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to load password reset requests"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleReject = async (request: PasswordResetRequestItem) => {
    if (!user) return
    const note = window.prompt(t("Optional note for the requester:")) ?? ""
    try {
      await rejectPasswordResetRequest(request.id, user.id, note)
      toast.success(t("Request rejected"))
      load()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to reject the request"))
    }
  }

  if (loading) return <Loading text={t("Loading password reset requests...")} />
  if (loadError) {
    return (
      <Card role="alert">
        <CardHeader><CardTitle>{t("Couldn't load password reset requests")}</CardTitle></CardHeader>
        <CardContent>
          <Button className="mt-4" onClick={load}>{t("Try again")}</Button>
        </CardContent>
      </Card>
    )
  }

  const visible = filter === "pending" ? requests.filter((r) => r.status === "pending") : requests
  const pendingCount = requests.filter((r) => r.status === "pending").length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><KeyRound size={24} /> {t("Password resets")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("Resolve manual reset requests with a strong temporary password. The password is sent through the user's in-app inbox\n            and the user must change it on first login.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value as "pending" | "all")}
            className="px-3 py-2 rounded-lg border border-input bg-background text-sm">
            <option value="pending">{t("Pending (")}{pendingCount})</option>
            <option value="all">{t("All requests")}</option>
          </select>
          <Button variant="outline" className="gap-2" onClick={load}><RefreshCw size={15} /> {t("Refresh")}</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("Manual reset requests")}</CardTitle></CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <EmptyState
              title={filter === "pending" ? t("No pending requests") : t("No requests yet")}
              description={t("Users can request an administrator-assisted reset from the forgot-password page.")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Email")}</TableHead>
                  <TableHead>{t("Message")}</TableHead>
                  <TableHead>{t("Status")}</TableHead>
                  <TableHead>{t("Requested")}</TableHead>
                  <TableHead className="text-right">{t("Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="text-sm font-medium">{request.email}</TableCell>
                    <TableCell className="text-sm max-w-sm">
                      <p className="line-clamp-2">{request.message || "—"}</p>
                      {request.adminNote && <p className="text-xs text-muted-foreground mt-1">{t("Admin note:")} {request.adminNote}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={request.status === "pending" ? "secondary" : request.status === "resolved" ? "default" : "outline"}>
                        {t(request.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(request.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {request.status === "pending" ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" className="gap-1 text-primary" onClick={() => setResolving(request)}>
                            <ShieldCheck size={14} /> {t("Reset password")}
                          </Button>
                          <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => handleReject(request)}>
                            <XCircle size={14} />  {t("Reject")}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {request.handledAt ? formatDate(request.handledAt) : t("—")}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {user && <DirectResetPanel users={users} onDone={load} />}

      {resolving && user && (
        <ResolveDialog
          request={resolving}
          onClose={() => setResolving(null)}
          onDone={() => { setResolving(null); load() }}
        />
      )}
    </div>
  )
}

function ResolveDialog({
  request, onClose, onDone,
}: {
  request: PasswordResetRequestItem
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useLanguage()
  
  const [password, setPassword] = useState(() => generateStrongPassword())
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t("Could not copy the password"))
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await resolvePasswordResetRequest(request.id, password, note || undefined)
      toast.success(t("Temporary password sent through the user's inbox"))
      onDone()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to reset the password"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Reset password for")} {request.email}</DialogTitle>
          <DialogDescription>
            {t("Generate a new strong password or edit it. It is sent in an in-app message and the user must change it after signing in.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("Temporary password")}</label>
            <div className="flex gap-2">
              <Input value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
              <Button type="button" variant="outline" onClick={() => setPassword(generateStrongPassword())} title={t("Generate a new password")}>
                <RefreshCw size={15} />
              </Button>
              <Button type="button" variant="outline" onClick={copy} title={t("Copy password")}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t("At least 8 characters. Mix upper/lower case, digits and symbols.")}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("Note (optional)")}</label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Internal note")} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>{t("Cancel")}</Button>
            <Button type="submit" disabled={saving}>{saving ? t("Resetting...") : t("Reset & send password")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DirectResetPanel({ users, onDone }: { users: any[]; onDone: () => void }) {
  const { t } = useLanguage()
  
  const [userId, setUserId] = useState("")
  const [password, setPassword] = useState("")
  const [saving, setSaving] = useState(false)

  const generate = () => setPassword(generateStrongPassword())

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    setSaving(true)
    try {
      await adminSetPassword(userId, password)
      toast.success(t("Temporary password set and sent to the user's inbox"))
      setUserId("")
      setPassword("")
      onDone()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to set the password"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserCog size={16} /> {t("Set a password directly")}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid lg:grid-cols-4 gap-3 items-end">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium mb-1">{t("User")}</label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} required
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="">{t("Select a user")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.profile ? `${u.profile.firstName} ${u.profile.lastName} — ${u.email}` : u.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">{t("Temporary password")}</label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required placeholder={t("Generate or type")} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={generate} title={t("Generate a strong password")}><RefreshCw size={15} /></Button>
            <Button type="submit" disabled={saving || !password}>{saving ? t("Saving...") : t("Set password")}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

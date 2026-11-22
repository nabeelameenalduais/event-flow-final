import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { runtimeFormatDate as formatDate } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect, useCallback } from "react"
import { ShieldOff, Plus, Check, X, RotateCcw, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Badge } from "../components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { useAuth } from "../contexts/AuthContext"
import {
  getBansPage,
  createBan,
  approveBan,
  rejectBan,
  revokeBan,
  approveBanRevoke,
  rejectBanRevoke,
  requestBanRevoke,
  getUserRegistrationSummary,
  type BanPageData,
  type BanWithNames,
  type UserRegistrationSummary,
} from "../services/banService"
import type { BanScope, UserBan } from "../types"

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "destructive",
  pending: "secondary",
  rejected: "outline",
  revoked: "outline",
  expired: "outline",
}

export function Bans() {
  const { t, tp } = useLanguage()
  
  const { user, role } = useAuth()
  const isAdmin = role === "admin"

  const [bans, setBans] = useState<BanWithNames[]>([])
  const [revokeRequests, setRevokeRequests] = useState<BanPageData["revokeRequests"]>([])
  const [users, setUsers] = useState<BanPageData["users"]>([])
  const [events, setEvents] = useState<BanPageData["events"]>([])
  const [categories, setCategories] = useState<BanPageData["categories"]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [userId, setUserId] = useState("")
  const [scope, setScope] = useState<BanScope>("global")
  const [eventId, setEventId] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [reason, setReason] = useState("")
  const [isPermanent, setIsPermanent] = useState(true)
  const [expiresAt, setExpiresAt] = useState("")
  const [notifyUser, setNotifyUser] = useState(true)
  const [saving, setSaving] = useState(false)
  const [summary, setSummary] = useState<UserRegistrationSummary[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getBansPage()
      setBans(data.bans)
      setRevokeRequests(data.revokeRequests)
      setUsers(data.users)
      setEvents(data.events)
      setCategories(data.categories)
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to load bans"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!userId) {
      setSummary([])
      return
    }
    getUserRegistrationSummary(userId).then(setSummary).catch(() => setSummary([]))
  }, [userId])

  const resetForm = () => {
    setUserId("")
    setScope("global")
    setEventId("")
    setCategoryId("")
    setReason("")
    setIsPermanent(true)
    setExpiresAt("")
    setNotifyUser(true)
    setSummary([])
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    try {
      await createBan({
        userId,
        scope,
        eventId: scope === "event" ? eventId : undefined,
        categoryId: scope === "category" ? categoryId : undefined,
        reason,
        isPermanent,
        expiresAt: isPermanent ? undefined : new Date(expiresAt).toISOString(),
        notifyUser,
      })
      toast.success(localizeToast(isAdmin ? "Ban applied immediately" : "Ban request sent to administrators"))
      resetForm()
      setShowForm(false)
      load()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to save the ban"))
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async (ban: UserBan) => {
    if (!user) return
    try {
      await approveBan(ban.id)
      toast.success(t("Ban approved and activated"))
      load()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to approve"))
    }
  }

  const handleReject = async (ban: UserBan) => {
    if (!user) return
    try {
      await rejectBan(ban.id)
      toast.success(t("Ban request rejected"))
      load()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to reject"))
    }
  }

  const handleRevoke = async (ban: UserBan) => {
    if (!user) return
    const reasonText = window.prompt(t("Why is this ban being lifted?")) ?? ""
    try {
      await revokeBan(ban.id, reasonText)
      toast.success(t("Ban lifted"))
      load()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to lift the ban"))
    }
  }

  const handleRequestRevoke = async (ban: UserBan) => {
    if (!user) return
    const reasonText = window.prompt(t("Why should this ban be lifted? Administrators will review it.")) ?? ""
    if (!reasonText.trim()) return
    try {
      await requestBanRevoke(ban.id, reasonText)
      toast.success(t("Lift request sent to administrators"))
      load()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to send the request"))
    }
  }

  const handleRevokeRequest = async (id: string, approve: boolean) => {
    if (!user) return
    try {
      if (approve) await approveBanRevoke(id)
      else await rejectBanRevoke(id)
      toast.success(localizeToast(approve ? "Lift request approved" : "Lift request rejected"))
      load()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to handle the request"))
    }
  }

  if (loading) return <Loading text={t("Loading bans...")} />

  const visibleBans = isAdmin ? bans : bans.filter((b) => b.requestedBy === user?.id)
  const pendingBans = visibleBans.filter((b) => b.status === "pending")
  const activeBans = visibleBans.filter((b) => b.status === "active")

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldOff size={24} /> {t("User bans")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("Bans block new registrations only. Existing registrations are never removed automatically.")}
            {!isAdmin && ` ${t("Organizer requests need administrator approval.")}`}
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowForm((v) => !v)}>
          <Plus size={16} /> {showForm ? t("Close form") : isAdmin ? t("Ban a user") : t("Request a ban")}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">{isAdmin ? t("New ban") : t("New ban request")}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t("User")}</label>
                  <select value={userId} onChange={(e) => setUserId(e.target.value)} required
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                    <option value="">{t("Select a user")}</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} {t("—")} {u.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("Scope")}</label>
                  <select value={scope} onChange={(e) => setScope(e.target.value as BanScope)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                    <option value="global">{t("Global (all events)")}</option>
                    <option value="event">{t("One event")}</option>
                    <option value="category">{t("One category")}</option>
                  </select>
                </div>
              </div>

              {scope === "event" && (
                <div>
                  <label className="block text-sm font-medium mb-1">{t("Event")}</label>
                  <select value={eventId} onChange={(e) => setEventId(e.target.value)} required
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                    <option value="">{t("Select an event")}</option>
                    {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                  </select>
                </div>
              )}

              {scope === "category" && (
                <div>
                  <label className="block text-sm font-medium mb-1">{t("Category")}</label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                    <option value="">{t("Select a category")}</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">{t("Reason")}</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                  placeholder={t("Explain the reason for this ban")} />
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={isPermanent} onChange={(e) => setIsPermanent(e.target.checked)} />
                  {t("Permanent")}
                </label>
                {!isPermanent && (
                  <div className="flex items-center gap-2 text-sm">
                    <span>{t("Ends on")}</span>
                    <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} required className="w-auto" />
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={notifyUser} onChange={(e) => setNotifyUser(e.target.checked)} />
                  {t("Notify the user with the reason")}
                </label>
              </div>

              {summary.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-sm font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <AlertTriangle size={15} /> {tp("This user has {count} existing registration", "This user has {count} existing registrations", summary.length)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("Existing registrations stay valid; only new registrations will be blocked.")}
                  </p>
                  <ul className="mt-2 text-xs text-muted-foreground space-y-0.5 max-h-28 overflow-y-auto">
                    {summary.map((s) => (
                      <li key={s.id}>{s.eventTitle} {t("—")} {t(s.status)} ({formatDate(s.registeredAt)})</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { resetForm(); setShowForm(false) }}>{t("Cancel")}</Button>
                <Button type="submit" disabled={saving}>{saving ? t("Saving...") : isAdmin ? t("Apply ban") : t("Send request")}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isAdmin && pendingBans.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("Pending organizer requests (")}{pendingBans.length})</CardTitle></CardHeader>
          <CardContent>
            <BanTable bans={pendingBans} isAdmin={isAdmin} onApprove={handleApprove} onReject={handleReject} onRevoke={handleRevoke} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">{t("Active bans (")}{activeBans.length})</CardTitle></CardHeader>
        <CardContent>
          {activeBans.length === 0 ? (
            <EmptyState title={t("No active bans")} description={t("Users who are blocked from new registrations appear here.")} />
          ) : (
            <BanTable bans={activeBans} isAdmin={isAdmin} onApprove={handleApprove} onReject={handleReject} onRevoke={handleRevoke} onRequestRevoke={handleRequestRevoke} />
          )}
        </CardContent>
      </Card>

      {isAdmin && revokeRequests.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("Lift requests")}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Reason")}</TableHead>
                  <TableHead>{t("Status")}</TableHead>
                  <TableHead>{t("Requested")}</TableHead>
                  <TableHead className="text-right">{t("Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revokeRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="max-w-md text-sm">{req.reason}</TableCell>
                    <TableCell><Badge variant={req.status === "pending" ? "secondary" : "outline"}>{t(req.status)}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(req.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {req.status === "pending" && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" className="text-green-600 gap-1" onClick={() => handleRevokeRequest(req.id, true)}>
                            <Check size={14} />  {t("Approve")}
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive gap-1" onClick={() => handleRevokeRequest(req.id, false)}>
                            <X size={14} />  {t("Reject")}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">{t("Ban history")}</CardTitle></CardHeader>
        <CardContent>
          {visibleBans.length === 0 ? (
            <EmptyState title={t("No bans yet")} description={t("Ban records will appear here.")} />
          ) : (
            <BanTable bans={visibleBans} isAdmin={isAdmin} readOnly onApprove={handleApprove} onReject={handleReject} onRevoke={handleRevoke} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function BanTable({
  bans,
  isAdmin,
  readOnly,
  onApprove,
  onReject,
  onRevoke,
  onRequestRevoke,
}: {
  bans: BanWithNames[]
  isAdmin: boolean
  readOnly?: boolean
  onApprove: (ban: UserBan) => void
  onReject: (ban: UserBan) => void
  onRevoke: (ban: UserBan) => void
  onRequestRevoke?: (ban: UserBan) => void
}) {
  const { t } = useLanguage()
  
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("User")}</TableHead>
          <TableHead>{t("Scope")}</TableHead>
          <TableHead>{t("Reason")}</TableHead>
          <TableHead>{t("Expires")}</TableHead>
          <TableHead>{t("Status")}</TableHead>
          {!readOnly && <TableHead className="text-right">{t("Actions")}</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {bans.map((ban) => (
          <TableRow key={ban.id}>
            <TableCell>
              <p className="font-medium text-sm">{ban.userName ?? t("Unknown")}</p>
              <p className="text-xs text-muted-foreground">{ban.userEmail}</p>
            </TableCell>
            <TableCell className="text-sm">
              {ban.scope === "global" ? t("Global") : ban.scope === "event" ? t("Event: {title}", { title: ban.eventTitle ?? t("—") }) : t("Category: {category}", { category: ban.categoryName ?? t("—") })}
            </TableCell>
            <TableCell className="text-sm max-w-xs truncate" title={ban.reason}>{ban.reason}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {ban.isPermanent ? t("Permanent") : ban.expiresAt ? formatDate(ban.expiresAt) : t("—")}
            </TableCell>
            <TableCell><Badge variant={statusVariant[ban.status] ?? "outline"}>{t(ban.status)}</Badge></TableCell>
            {!readOnly && (
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  {isAdmin && ban.status === "pending" && (
                    <>
                      <Button size="sm" variant="ghost" className="text-green-600 gap-1" onClick={() => onApprove(ban)}><Check size={14} />  {t("Approve")}</Button>
                      <Button size="sm" variant="ghost" className="text-destructive gap-1" onClick={() => onReject(ban)}><X size={14} />  {t("Reject")}</Button>
                    </>
                  )}
                  {isAdmin && ban.status === "active" && (
                    <Button size="sm" variant="ghost" className="gap-1" onClick={() => onRevoke(ban)}><RotateCcw size={14} />  {t("Lift")}</Button>
                  )}
                  {!isAdmin && ban.status === "active" && onRequestRevoke && (
                    <Button size="sm" variant="ghost" className="gap-1" onClick={() => onRequestRevoke(ban)}><RotateCcw size={14} /> {t("Request lift")}</Button>
                  )}
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

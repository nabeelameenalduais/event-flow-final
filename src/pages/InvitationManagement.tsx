import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { runtimeFormatDate as formatDate } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, Trash2, Copy, Check, Mail, UserCheck, UserX, Loader2, Search, Users } from "lucide-react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Checkbox } from "../components/ui/checkbox"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { useAuth } from "../contexts/AuthContext"
import { getEventById } from "../services/eventService"
import { canManageEvent } from "../utils/eventAccess"
import { getLinksByEvent, createLink, createLinksBulk, deleteLink } from "../services/invitationService"
import { checkUserExists } from "../services/authService"
import { createUser, getAllUsersForInvite, type InviteUser } from "../services/userService"
import type { InvitationLink } from "../types"

export function InvitationManagement() {
  const { t, tp } = useLanguage()
  
  const { eventId } = useParams<{ eventId: string }>()
  const { profile, role } = useAuth()
  const navigate = useNavigate()

  const [eventTitle, setEventTitle] = useState("")
  const [links, setLinks] = useState<InvitationLink[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // single-add flow with verification
  const [email, setEmail] = useState("")
  const [checking, setChecking] = useState(false)
  const [adding, setAdding] = useState(false)
  const [verification, setVerification] = useState<"idle" | "exists" | "missing">("idle")

  // new-user form (email prefilled)
  const [newUserOpen, setNewUserOpen] = useState(false)
  const [newUser, setNewUser] = useState({ email: "", firstName: "", lastName: "", password: "" })

  // user-list flow
  const [users, setUsers] = useState<InviteUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [userSearch, setUserSearch] = useState("")
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [invitedEmails, setInvitedEmails] = useState<Set<string>>(new Set())
  const [bulkGenerating, setBulkGenerating] = useState(false)

  const fetch = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    try {
      const event = await getEventById(eventId)
      if (!event) { navigate("/dashboard/events"); return }
      if (!(await canManageEvent(eventId, profile, role))) { navigate("/dashboard/events"); return }
      setEventTitle(event.title)
      const l = await getLinksByEvent(eventId)
      setLinks(l)
      setInvitedEmails(new Set(l.map((link) => link.email.toLowerCase())))
    } catch (e: any) {
      toast.error(localizeToast(e?.message ?? "Failed to load"))
    } finally {
      setLoading(false)
    }
    setUsersLoading(true)
    try {
      const all = await getAllUsersForInvite()
      setUsers(all)
    } catch {
      setUsers([])
      toast.error(t("Could not load the user list"))
    } finally {
      setUsersLoading(false)
    }
  }, [eventId, navigate, profile, role, t])

  useEffect(() => { fetch() }, [fetch])

  const handleVerify = async () => {
    if (!email.trim()) return
    setChecking(true)
    setVerification("idle")
    try {
      const exists = await checkUserExists(email.trim().toLowerCase())
      setVerification(exists ? "exists" : "missing")
      if (exists) {
        toast.success(t("Account found — ready to invite"))
      } else {
        toast.info(t("No account found. Add the user to create the invitation."))
      }
    } catch {
      toast.error(t("Could not verify email"))
    } finally {
      setChecking(false)
    }
  }

  const handleAdd = async () => {
    if (!eventId || !email.trim() || verification !== "exists") return
    setAdding(true)
    try {
      const link = await createLink(eventId, email.trim().toLowerCase())
      toast.success(t("Invitation created for {email}", { email: link.email }))
      setEmail("")
      setVerification("idle")
      fetch()
    } catch (err: any) {
      toast.error(localizeToast(err.message ?? "Failed to create invitation"))
    } finally {
      setAdding(false)
    }
  }

  const openAddUser = () => {
    setNewUser({ email: email.trim().toLowerCase(), firstName: "", lastName: "", password: "" })
    setNewUserOpen(true)
  }

  const handleCreateUserAndLink = async () => {
    if (!eventId) return
    if (!newUser.email.trim() || !newUser.firstName.trim() || !newUser.lastName.trim() || newUser.password.length < 6) {
      toast.error(t("Fill all fields (password min 6 chars)"))
      return
    }
    setAdding(true)
    try {
      await createUser({
        email: newUser.email.trim().toLowerCase(),
        password: newUser.password,
        firstName: newUser.firstName.trim(),
        lastName: newUser.lastName.trim(),
        roleName: "attendee",
      })
      const link = await createLink(eventId, newUser.email.trim().toLowerCase())
      toast.success(t("User created and invited ({email})", { email: link.email }))
      setNewUserOpen(false)
      setEmail("")
      setVerification("idle")
      fetch()
    } catch (err: any) {
      toast.error(localizeToast(err.message ?? "Failed to create user"))
    } finally {
      setAdding(false)
    }
  }

  const availableUsers = users.filter((u) => !invitedEmails.has(u.email.toLowerCase()))

  const filteredUsers = availableUsers.filter((u) => {
    const q = userSearch.trim().toLowerCase()
    if (!q) return true
    return (
      u.email.toLowerCase().includes(q) ||
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(q)
    )
  })

  const toggleAllUsers = (checked: boolean) => {
    setSelectedUsers(checked ? new Set(filteredUsers.map((u) => u.email)) : new Set())
  }

  const toggleUser = (email: string, checked: boolean) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev)
      if (checked) next.add(email)
      else next.delete(email)
      return next
    })
  }

  const handleGenerateFromList = async () => {
    if (!eventId || selectedUsers.size === 0) return
    setBulkGenerating(true)
    try {
      const created = await createLinksBulk(eventId, [...selectedUsers])
      if (created.length > 0) {
        toast.success(t("Created {count} invitation link(s)", { count: created.length }))
      } else {
        toast.info(t("All selected users already have links"))
      }
      setSelectedUsers(new Set())
      fetch()
    } catch (err: any) {
      toast.error(localizeToast(err.message ?? "Failed to create invitations"))
    } finally {
      setBulkGenerating(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteLink(id)
      toast.success(t("Invitation link removed"))
      fetch()
    } catch {
      toast.error(t("Failed to remove invitation"))
    }
  }

  const handleCopy = async (link: InvitationLink) => {
    const url = `${window.location.origin}/events/${eventId}?code=${link.code}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(link.id)
      toast.success(t("Link copied!"))
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error(t("Failed to copy"))
    }
  }

  if (loading) return <Loading text={t("Loading invitations...")} />

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/events")} className="gap-2">
        <ArrowLeft size={16} /> {t("Back to Events")}
      </Button>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("Invitations:")} {eventTitle}</h1>
        <Badge variant="secondary">{tp("{count} link", "{count} links", links.length)}</Badge>
      </div>

      {/* Single invite with verification */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold">{t("Invite One Person")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("First check the email, then generate a unique one-time link. Only confirmed accounts are invitable.")}
        </p>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder={t("Enter email address...")}
            value={email}
            onChange={(e) => { setEmail(e.target.value); setVerification("idle") }}
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            className="max-w-sm"
          />
          <Button variant="outline" onClick={handleVerify} disabled={checking || !email.trim()} className="gap-2">
            {checking ? <Loader2 size={15} className="animate-spin" /> : verification === "missing" ? <UserX size={15} /> : <UserCheck size={15} />}
            {checking ? "Checking..." : "Check"}
          </Button>
        </div>

        {verification === "exists" && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <UserCheck size={16} /> {t("Account exists.")}
            <Button size="sm" onClick={handleAdd} disabled={adding} className="gap-1.5">
              <Plus size={14} /> {adding ? t("Creating...") : t("Create Invitation")}
            </Button>
          </div>
        )}

        {verification === "missing" && (
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <UserX size={16} /> {t("No account found.")}
            <Button size="sm" variant="outline" onClick={openAddUser} className="gap-1.5">
              <UserCheck size={14} /> {t("Add User & Invite")}
            </Button>
          </div>
        )}
      </div>

      {/* Invite from user list */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("Invite Users")}</h2>
          <Badge variant="secondary">{t("{count} available", { count: availableUsers.length })}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("Select the users you want to invite to this private event. Users who already have a link are shown at the bottom as already invited.")}
        </p>

        <div className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder={t("Search by name or email...")}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={() => setUserSearch("")} disabled={!userSearch}>{t("Clear")}</Button>
        </div>

        {usersLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">{t("Loading users...")}</div>
        ) : users.length === 0 ? (
          <EmptyState title={t("No users found")} description={t("Create attendee accounts first, then invite them here.")} />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Checkbox
                id="select-all-users"
                checked={filteredUsers.length > 0 && selectedUsers.size === filteredUsers.length}
                onCheckedChange={(c) => toggleAllUsers(!!c)}
                label={<span className="text-sm font-medium">{t("Select all")} {filteredUsers.length} {t("user(s)")}</span>}
              />
            </div>
            <div className="max-h-80 overflow-y-auto space-y-1.5 border border-border rounded-lg p-2">
              {filteredUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t("No users match your search")}</p>
              ) : (
                filteredUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                    <Checkbox
                      id={`inv-user-${u.id}`}
                      checked={selectedUsers.has(u.email)}
                      onCheckedChange={(c) => toggleUser(u.email, !!c)}
                      label={
                        <span className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{u.firstName} {u.lastName}</span>
                          <span className="text-muted-foreground">{u.email}</span>
                          <Badge variant="outline" className="capitalize">{u.roleName}</Badge>
                        </span>
                      }
                    />
                  </div>
                ))
              )}
            </div>
            <Button onClick={handleGenerateFromList} disabled={bulkGenerating || selectedUsers.size === 0} className="gap-2">
              <Loader2 size={15} className={bulkGenerating ? "animate-spin" : "hidden"} />
              <Users size={15} className={bulkGenerating ? "hidden" : ""} />
              
              {t("Generate")} {selectedUsers.size > 0 ? `(${selectedUsers.size})` : ""} {tp("Invitation Link", "Invitation Links", selectedUsers.size)}
            </Button>
          </div>
        )}

        {invitedEmails.size > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">{t("Already invited (")}{invitedEmails.size})</p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {users.filter((u) => invitedEmails.has(u.email.toLowerCase())).map((u) => (
                <div key={u.id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-1.5 text-sm">
                  <Mail size={13} className="text-muted-foreground" />
                  <span className="font-medium">{u.firstName} {u.lastName}</span>
                  <span className="text-muted-foreground text-xs">{u.email}</span>
                  <Badge variant="secondary" className="ml-auto">{t("invited")}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Existing links */}
      {links.length === 0 ? (
        <EmptyState title={t("No invitation links yet")} description={t("Use the flow above to invite people.")} />
      ) : (
        <div className="rounded-lg border border-border">
          <div className="px-4 py-3 border-b border-border bg-muted/20 font-semibold">{t("Existing Links")}</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Email")}</TableHead>
                <TableHead>{t("Status")}</TableHead>
                <TableHead>{t("Created")}</TableHead>
                <TableHead className="text-right">{t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((link) => (
                <TableRow key={link.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-muted-foreground" />
                      <span className="font-medium">{link.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={link.used ? "outline" : "default"}>
                      {link.used ? "Used" : t("Active")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(link.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleCopy(link)}>
                        {copiedId === link.id ? <Check size={14} /> : <Copy size={14} />}
                        {copiedId === link.id ? "Copied" : t("Copy")}
                      </Button>
                      {!link.used && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(link.id)}>
                          <Trash2 size={14} /> {t("Remove")}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add-user dialog */}
      {newUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setNewUserOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-card p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{t("Add New User & Invite")}</h2>
            <p className="text-sm text-muted-foreground">{t("A new attendee account will be created, then the invitation link generated.")}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">{t("Email")}</label>
                <Input value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} type="email" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">{t("First name")}</label>
                  <Input value={newUser.firstName} onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("Last name")}</label>
                  <Input value={newUser.lastName} onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("Temporary password")}</label>
                <Input value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} type="password" placeholder={t("min 6 characters")} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setNewUserOpen(false)}>{t("Cancel")}</Button>
              <Button onClick={handleCreateUserAndLink} disabled={adding}>{adding ? t("Creating...") : t("Create & Invite")}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { runtimeFormatDate as formatDate } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect, useCallback } from "react"
import { Link } from "react-router-dom"
import { Search, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog"
import { getUsers, suspendUser, activateUser, createUser } from "../services/userService"
import type { RoleName } from "../types"

interface FilterState {
  search: string
  role: string
  status: string
  page: number
}

export function UserManagement() {
  const { t } = useLanguage()
  
  const [filters, setFilters] = useState<FilterState>({ search: "", role: "", status: "", page: 1 })
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ email: "", password: "", firstName: "", lastName: "", role: "attendee" as RoleName })
  const [creating, setCreating] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getUsers({
        search: filters.search || undefined,
        role: filters.role || undefined,
        status: filters.status || undefined,
        page: filters.page,
        pageSize: 10,
      })
      setData(result)
    } catch (e: any) {
      toast.error(localizeToast(e?.message ?? "Failed to load users"))
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleSuspend = async (id: string, name: string) => {
    try {
      await suspendUser(id)
      toast.success(t("{name} suspended", { name }))
      fetchUsers()
    } catch (e: any) {
      toast.error(localizeToast(e?.message ?? "Failed to suspend user"))
    }
  }

  const handleActivate = async (id: string, name: string) => {
    try {
      await activateUser(id)
      toast.success(t("{name} activated", { name }))
      fetchUsers()
    } catch (e: any) {
      toast.error(localizeToast(e?.message ?? "Failed to activate user"))
    }
  }

  const handleCreate = async () => {
    if (!createForm.email || !createForm.password || !createForm.firstName || !createForm.lastName) {
      toast.error(t("All fields are required"))
      return
    }
    setCreating(true)
    try {
      await createUser({ ...createForm, roleName: createForm.role })
      toast.success(t("User created successfully"))
      setShowCreate(false)
      setCreateForm({ email: "", password: "", firstName: "", lastName: "", role: "attendee" })
      fetchUsers()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to create user"))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("User Management")}</h1>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><Plus size={16} /> {t("Create User")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("Create User")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t("Email")}</label>
                <Input value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">{t("Password")}</label>
                <Input type="password" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">{t("First Name")}</label>
                  <Input value={createForm.firstName} onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium">{t("Last Name")}</label>
                  <Input value={createForm.lastName} onChange={(e) => setCreateForm((f) => ({ ...f, lastName: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">{t("Role")}</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as RoleName }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mt-1"
                >
                  <option value="attendee">{t("Attendee")}</option>
                  <option value="organizer">{t("Organizer")}</option>
                  <option value="admin">{t("Admin")}</option>
                </select>
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={creating}>
                {creating ? t("Creating...") : t("Create User")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("Search by name or email...")}
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
            className="pl-9"
          />
        </div>
        <select
          value={filters.role}
          onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value, page: 1 }))}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">{t("All roles")}</option>
          <option value="admin">{t("Admin")}</option>
          <option value="organizer">{t("Organizer")}</option>
          <option value="attendee">{t("Attendee")}</option>
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">{t("All status")}</option>
          <option value="active">{t("Active")}</option>
          <option value="suspended">{t("Suspended")}</option>
        </select>
      </div>

      {loading ? <Loading text={t("Loading users...")} /> : !data || data.items.length === 0 ? (
        <EmptyState title={t("No users found")} description={t("Try adjusting your search or filters.")} />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Name")}</TableHead>
                <TableHead>{t("Email")}</TableHead>
                <TableHead>{t("Role")}</TableHead>
                <TableHead>{t("Status")}</TableHead>
                <TableHead>{t("Joined")}</TableHead>
                <TableHead className="text-right">{t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((user: any) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Link to={`/dashboard/admin/users/${user.id}`} className="font-medium hover:text-primary transition-colors">
                      {user.profile?.firstName} {user.profile?.lastName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.roleName === "admin" ? "default" : user.roleName === "organizer" ? "secondary" : "outline"}>
                      {t(user.roleName)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.suspended ? "destructive" : "secondary"}>
                      {user.suspended ? t("Suspended") : t("Active")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {user.suspended ? (
                        <Button size="sm" variant="outline" onClick={() => handleActivate(user.id, user.profile?.firstName)}>
                          
                          {t("Activate")}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleSuspend(user.id, user.profile?.firstName)}>
                          
                          {t("Suspend")}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={`/dashboard/admin/users/${user.id}`}>{t("View")}</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-sm text-muted-foreground">
                
                {t("Page")} {data.page} {t("of")} {data.totalPages} ({data.total} {t("users)")}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={data.page <= 1}
                  onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>
                  <ChevronLeft size={16} />  {t("Previous")}
                </Button>
                <Button size="sm" variant="outline" disabled={data.page >= data.totalPages}
                  onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>
                  
                  {t("Next")} <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

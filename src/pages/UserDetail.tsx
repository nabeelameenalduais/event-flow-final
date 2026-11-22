import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { runtimeFormatDate as formatDate } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Mail, Phone, Calendar, Shield } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Avatar, AvatarFallback } from "../components/ui/avatar"
import { Loading } from "../components/ui/Loading"
import { getUserById, updateUser, suspendUser, activateUser, getRoles } from "../services/userService"

export function UserDetail() {
  const { t } = useLanguage()
  
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ firstName: "", lastName: "", roleId: "" })

  useEffect(() => {
    if (!id) return
    Promise.all([getUserById(id), getRoles()]).then(([userData, rolesData]) => {
      if (userData) {
        setUser(userData)
        setForm({
          firstName: userData.profile?.firstName ?? "",
          lastName: userData.profile?.lastName ?? "",
          roleId: userData.profile?.roleId ?? "",
        })
      }
      setRoles(rolesData)
      setLoading(false)
    }).catch((e: any) => {
      toast.error(localizeToast(e?.message ?? "Failed to load user"))
      setLoading(false)
    })
  }, [id])

  if (loading) return <Loading text={t("Loading user...")} />
  if (!user) return <div className="text-center py-20 text-muted-foreground">{t("User not found")}</div>

  const initials = `${user.profile?.firstName?.[0] ?? ""}${user.profile?.lastName?.[0] ?? ""}`

  const handleSave = async () => {
    try {
      await updateUser(user.id, form)
      const updated = await getUserById(user.id)
      if (updated) setUser(updated)
      setEditing(false)
      toast.success(t("User updated"))
    } catch (e: any) {
      toast.error(localizeToast(e?.message ?? "Failed to save user"))
    }
  }

  const handleSuspend = async () => {
    try {
      await suspendUser(user.id)
      const updated = await getUserById(user.id)
      if (updated) setUser(updated)
      toast.success(t("User suspended"))
    } catch (e: any) {
      toast.error(localizeToast(e?.message ?? "Failed to suspend user"))
    }
  }

  const handleActivate = async () => {
    try {
      await activateUser(user.id)
      const updated = await getUserById(user.id)
      if (updated) setUser(updated)
      toast.success(t("User activated"))
    } catch (e: any) {
      toast.error(localizeToast(e?.message ?? "Failed to activate user"))
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
        <ArrowLeft size={16} /> {t("Back to Admin")}
      </Button>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">{user.profile?.firstName} {user.profile?.lastName}</h2>
                  <Badge variant={user.suspended ? "destructive" : "secondary"}>
                    {user.suspended ? "Suspended" : t("Active")}
                  </Badge>
                </div>
                <Badge variant={user.roleName === "admin" ? "default" : user.roleName === "organizer" ? "secondary" : "outline"} className="mt-1">
                  {user.roleName}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)}>{t("Cancel")}</Button>
                  <Button size="sm" onClick={handleSave}>{t("Save")}</Button>
                </>
              ) : (
                <>
                  {user.suspended ? (
                    <Button size="sm" onClick={handleActivate}>{t("Activate")}</Button>
                  ) : (
                    <Button size="sm" variant="outline" className="text-destructive" onClick={handleSuspend}>{t("Suspend")}</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>{t("Edit")}</Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("Details")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t("First name")}</label>
                  <input
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("Last name")}</label>
                  <input
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("Role")}</label>
                <select
                  value={form.roleId}
                  onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 text-sm">
                <Mail size={16} className="text-muted-foreground" />
                <span>{user.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone size={16} className="text-muted-foreground" />
                <span>{user.profile?.phoneNumber || "Not provided"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar size={16} className="text-muted-foreground" />
                <span>{t("Joined")} {formatDate(user.createdAt)}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield size={16} className="text-muted-foreground" />
                <span className="capitalize">{user.roleName}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

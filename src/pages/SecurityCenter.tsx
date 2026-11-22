import { runtimeFormatDateTime as formatDateTime, runtimeFormatDate as formatDate } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect } from "react"
import { Shield, AlertTriangle, UserCheck } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Card, CardContent } from "../components/ui/card"
import { Loading } from "../components/ui/Loading"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { getAuditLogs } from "../services/auditService"
import { supabase } from "../lib/supabase"
import type { AuditLog } from "../types"

const actionColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  create: "default",
  update: "secondary",
  delete: "destructive",
  login: "outline",
  logout: "outline",
  register: "default",
  suspend: "destructive",
  activate: "default",
  publish: "default",
  archive: "secondary",
  check_in: "default",
  check_out: "secondary",
  cancel: "destructive",
}

export function SecurityCenter() {
  const { t } = useLanguage()
  
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [userProfileMap, setUserProfileMap] = useState<Map<string, any>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const [logData, { data: userRows }] = await Promise.all([
        getAuditLogs(),
        supabase.from("users").select("id, email, suspended, created_at"),
      ])
      setLogs(logData)
      setAllUsers(userRows ?? [])

      const userIds = [...new Set(logData.map((l) => l.userId))] as string[]
      const suspendedIds = (userRows ?? []).filter((u: any) => u.suspended).map((u: any) => u.id)
      const allIds = [...new Set([...userIds, ...suspendedIds])]
      if (allIds.length > 0) {
        const profs = await supabase
          .from("profiles")
          .select("id, user_id, first_name, last_name")
          .in("user_id", allIds)
        const pmap = new Map()
        for (const p of profs.data ?? []) {
          pmap.set(p.user_id, p)
        }
        setUserProfileMap(pmap)
      }
      setLoading(false)
    })()
  }, [])

  const suspendedUsers = allUsers.filter((u: any) => u.suspended)

  if (loading) return <Loading text={t("Loading security data...")} />

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("Security Center")}</h1>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10"><Shield size={20} className="text-blue-500" /></div>
            <div>
              <p className="text-xs text-muted-foreground">{t("Total Audit Events")}</p>
              <p className="text-xl font-bold">{logs.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10"><AlertTriangle size={20} className="text-red-500" /></div>
            <div>
              <p className="text-xs text-muted-foreground">{t("Suspended Users")}</p>
              <p className="text-xl font-bold">{suspendedUsers.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><UserCheck size={20} className="text-green-500" /></div>
            <div>
              <p className="text-xs text-muted-foreground">{t("Active Users")}</p>
              <p className="text-xl font-bold">{allUsers.length - suspendedUsers.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="audit">
        <TabsList>
          <TabsTrigger value="audit">{t("Audit Log")}</TabsTrigger>
          <TabsTrigger value="suspended">{t("Suspended Users (")}{suspendedUsers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="mt-4">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("No audit logs.")}</p>
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("User")}</TableHead>
                    <TableHead>{t("Action")}</TableHead>
                    <TableHead>{t("Details")}</TableHead>
                    <TableHead>{t("IP Address")}</TableHead>
                    <TableHead>{t("Date")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const u = allUsers.find((u: any) => u.id === log.userId)
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">{u?.email ?? log.userId}</TableCell>
                        <TableCell>
                          <Badge variant={actionColors[log.action] ?? "outline"} className="capitalize">{log.action}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{log.details}</TableCell>
                        <TableCell className="text-sm text-muted-foreground font-mono">{log.ipAddress}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDateTime(log.createdAt)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="suspended" className="mt-4">
          {suspendedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("No suspended users.")}</p>
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Email")}</TableHead>
                    <TableHead>{t("Status")}</TableHead>
                    <TableHead>{t("Created")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suspendedUsers.map((u: any) => {
                    const p = userProfileMap.get(u.id)
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <p className="font-medium">{u.email}</p>
                          <p className="text-xs text-muted-foreground">{p?.first_name} {p?.last_name}</p>
                        </TableCell>
                        <TableCell><Badge variant="destructive">{t("Suspended")}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(u.created_at)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

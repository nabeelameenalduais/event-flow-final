import { runtimeFormatNumber as formatNumber } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect } from "react"
import {
  Download, Printer, BarChart3, PieChart, TrendingUp, Star, Users, Wallet,
  CalendarDays, MapPin, ClipboardList,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Loading } from "../components/ui/Loading"
import { getReportData, exportToCsv, type ReportModeFilter } from "../services/reportsService"

const COLORS = ["#007bff", "#28a745", "#6f42c1", "#fd7e14", "#e83e8c", "#20c997", "#ffc107", "#dc3545", "#17a2b8", "#6c757d"]

export function Reports() {
  const { t } = useLanguage()
  
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [modeFilter, setModeFilter] = useState<ReportModeFilter>("all")

  useEffect(() => {
    let active = true
    setLoading(true)
    getReportData(modeFilter)
      .then((d) => { if (active) { setData(d); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [modeFilter])

  if (loading) return <Loading text={t("Loading reports...")} />
  if (!data) return null

  const handlePrint = () => window.print()

  const exportSection = (rows: Record<string, any>[], name: string) => exportToCsv(rows, `${name}.csv`)

  const handleExportAll = () => {
  
    exportSection(data.eventPopularity.map((e: any) => ({ "Event": e.name, Registrations: e.registrations })), "event-popularity")
    exportSection(data.attendanceRateByEvent.map((e: any) => ({
      "Event": e.name, Registered: e.registered, Attended: e.attended, "Attendance %": e.rate, "Fill %": e.fillRate,
    })), "attendance")
    exportSection(data.topAttendees.map((a: any) => ({ Name: a.name, "Events Attended": a.attended })), "top-attendees")
    exportSection(data.avgRatingByEvent.map((e: any) => ({
      "Event": e.name, "Avg Rating": e.average, Count: e.count,
    })), "ratings")
    exportSection(data.costsByEvent.map((c: any) => ({
      "Event": c.name, Planned: c.planned, Actual: c.actual, Difference: c.difference,
    })), "costs")
    exportSection(data.registrationTrend.map((t: any) => ({ Month: t.month, Registrations: t.count })), "registration-trend")
    exportSection(data.attendanceByMode.map((m: any) => ({
      Mode: m.name, "Confirmed registrations": m.confirmed, Attended: m.attended,
    })), "attendance-by-mode")
    exportSection(data.statusPie, "registrations-by-status")
    exportSection(data.attendanceRateByEvent.map((e: any) => ({
      "Event": e.name, Status: t(e.status ?? "published"), Confirmed: e.confirmed, Cancelled: e.cancelled, Waitlisted: e.waitlisted, Attended: e.attended,
    })), "per-event-detail")
  }

  return (
    <div className="space-y-6" id="reports-root">
      <div className="flex items-center justify-between no-print">
        <h1 className="text-2xl font-bold">{t("Comprehensive Reports")}</h1>
        <div className="flex items-center gap-2">
          <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value as ReportModeFilter)}
            className="px-3 py-2 rounded-lg border border-input bg-background text-sm">
            <option value="all">{t("All attendance modes")}</option>
            <option value="in_person">{t("In person only")}</option>
            <option value="online">{t("Online only")}</option>
          </select>
          <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
            <Printer size={15} /> {t("Print")}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportAll}>
            <Download size={15} /> {t("Export All (CSV)")}
          </Button>
        </div>
      </div>

      {/* 1. Overview */}
      <SectionTitle icon={BarChart3} title={t("Overview")} />
      <div className="grid sm:grid-cols-4 gap-4">
        <StatCard label={t("Total Events")} value={data.summary.totalEvents} icon={CalendarDays} />
        <StatCard label={t("Total Users")} value={data.summary.totalUsers} icon={Users} />
        <StatCard label={t("Total Registrations")} value={data.summary.totalRegs} icon={TrendingUp} />
        <StatCard label={t("Confirmed")} value={data.summary.confirmedRegs} color="bg-green-500/10 text-green-600" />
        <StatCard label={t("Cancelled")} value={data.summary.cancelledRegs} color="bg-red-500/10 text-red-600" />
        <StatCard label={t("Waitlisted")} value={data.summary.waitlistedRegs} color="bg-amber-500/10 text-amber-600" />
        <StatCard label={t("Attendance")} value={data.summary.totalAttendance} color="bg-blue-500/10 text-blue-600" />
        <StatCard label={t("Avg Rating")} value={data.summary.averageRating} icon={Star} color="bg-yellow-500/10 text-yellow-600" />
      </div>

      {/* 2. Users / commitment */}
      <SectionTitle icon={Users} title={t("Users, Commitment & No-Shows")} />
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("Users by Role")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <RePieChart>
                <Pie data={data.usersByRole.map((d: any) => ({ ...d, name: t(d.name) }))} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {data.usersByRole.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </RePieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("Attendance Commitment")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <CommitmentBar
              label={t("Attended at least one event")}
              value={data.attendanceCommitment.attended}
              total={data.attendanceCommitment.attended + data.attendanceCommitment.noShow}
              color="bg-green-500"
            />
            <CommitmentBar
              label={t("Registered but never attended")}
              value={data.attendanceCommitment.noShow}
              total={data.attendanceCommitment.attended + data.attendanceCommitment.noShow}
              color="bg-red-500"
            />
            <p className="text-sm text-muted-foreground pt-1">
              {t("Suspended accounts:")} <Badge variant="outline">{data.suspendedCount}</Badge>
            </p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">{t("Top Attendees")}</CardTitle></CardHeader>
          <CardContent>
            {data.topAttendees.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("No data yet.")}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>{t("Name")}</TableHead>
                      <TableHead className="text-right">{t("Events Attended")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topAttendees.map((a: any, i: number) => (
                      <TableRow key={a.profileId}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell className="text-right">{a.attended}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3. Events / most requested */}
      <SectionTitle icon={CalendarDays} title={t("Events & Most Requested")} />
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("Event Popularity (Registrations)")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.eventPopularity} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="registrations" fill="#6f42c1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("Events by Status")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <RePieChart>
                <Pie data={data.eventsByStatus.map((d: any) => ({ ...d, name: t(d.name) }))} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {data.eventsByStatus.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </RePieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 4. Attendance */}
      <SectionTitle icon={ClipboardList} title={t("Attendance")} />
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("Attendance by Event Type")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.attendanceByType.map((d: any) => ({ ...d, name: t(d.name) }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#20c997" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("Attendance & Fill Rate by Event")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.attendanceRateByEvent}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="registered" name={t("Registered")} fill="#007bff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="attended" name={t("Attended")} fill="#28a745" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("Attendance by Mode")}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Mode")}</TableHead>
                  <TableHead className="text-right">{t("Confirmed")}</TableHead>
                  <TableHead className="text-right">{t("Attended")}</TableHead>
                  <TableHead className="text-right">{t("Rate")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.attendanceByMode.map((m: any) => (
                  <TableRow key={m.mode}>
                    <TableCell className="font-medium">{t(m.name)}</TableCell>
                    <TableCell className="text-right">{m.confirmed}</TableCell>
                    <TableCell className="text-right">{m.attended}</TableCell>
                    <TableCell className="text-right">
                      {m.confirmed > 0 ? Math.round((m.attended / m.confirmed) * 100) : 0}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* 5. Evaluation */}
      <SectionTitle icon={Star} title={t("Evaluation & Feedback")} />
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("Registration Trend (by month)")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.registrationTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#007bff" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("Registrations by Status")}</CardTitle></CardHeader>
          <CardContent>
            {data.statusPie.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("No data yet.")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <RePieChart>
                  <Pie data={data.statusPie.map((d: any) => ({ ...d, name: t(d.name) }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {data.statusPie.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </RePieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("Rating Distribution")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.ratingDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#ffc107" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">{t("Average Rating by Event")}</CardTitle></CardHeader>
          <CardContent>
            {data.avgRatingByEvent.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("No ratings yet.")}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Event")}</TableHead>
                      <TableHead className="text-right">{t("Avg Rating")}</TableHead>
                      <TableHead className="text-right">{t("Responses")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.avgRatingByEvent.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.name}</TableCell>
                        <TableCell className="text-right">{e.average}</TableCell>
                        <TableCell className="text-right">{e.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 6. Costs */}
      <SectionTitle icon={Wallet} title={t("Costs")} />
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard label={t("Total Planned")} value={formatNumber(data.summary.totalPlannedCosts)} icon={Wallet} color="bg-blue-500/10 text-blue-600" />
        <StatCard label={t("Total Actual")} value={formatNumber(data.summary.totalActualCosts)} icon={Wallet} color="bg-amber-500/10 text-amber-600" />
        <StatCard
          label={t("Difference")}
          value={`${(data.summary.totalPlannedCosts - data.summary.totalActualCosts) >= 0 ? "+" : ""}${formatNumber(data.summary.totalPlannedCosts - data.summary.totalActualCosts)}`}
          icon={PieChart}
          color="bg-green-500/10 text-green-600"
        />
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("Planned vs Actual by Event")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.costsByEvent}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="planned" name={t("Planned")} fill="#007bff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name={t("Actual")} fill="#fd7e14" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("Costs by Need Type")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <RePieChart>
                <Pie data={Object.entries(data.needTypeDist).map(([name, value]) => ({ name: t(name), value }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {Object.entries(data.needTypeDist).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </RePieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 7. Categories & Venues */}
      <SectionTitle icon={MapPin} title={t("Categories & Venues")} />
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("Events by Category")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.categoryBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#28a745" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("Events by Venue")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.venueBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#e83e8c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 8. Per-event detail */}
      <SectionTitle icon={ClipboardList} title={t("Per-Event Detail")} />
      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Event")}</TableHead>
                  <TableHead>{t("Status")}</TableHead>
                  <TableHead>{t("Type")}</TableHead>
                  <TableHead className="text-right">{t("Online")}</TableHead>
                  <TableHead className="text-right">{t("In person")}</TableHead>
                  <TableHead className="text-right">{t("Capacity")}</TableHead>
                  <TableHead className="text-right">{t("Confirmed")}</TableHead>
                  <TableHead className="text-right">{t("Cancelled")}</TableHead>
                  <TableHead className="text-right">{t("Waitlisted")}</TableHead>
                  <TableHead className="text-right">{t("Attendance %")}</TableHead>
                  <TableHead className="text-right">{t("Fill %")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.attendanceRateByEvent.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell><Badge variant="outline">{t(e.status ?? "published")}</Badge></TableCell>
                    <TableCell>
                      <Badge variant="secondary">{t(data.events.find((ev: any) => ev.id === e.id)?.event_type ?? "in_person")}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{e.online ?? 0}</TableCell>
                    <TableCell className="text-right">{e.inPerson ?? 0}</TableCell>
                    <TableCell className="text-right">{data.events.find((ev: any) => ev.id === e.id)?.capacity ?? t("—")}</TableCell>
                    <TableCell className="text-right">{e.confirmed ?? e.registered}</TableCell>
                    <TableCell className="text-right">{e.cancelled ?? 0}</TableCell>
                    <TableCell className="text-right">{e.waitlisted ?? 0}</TableCell>
                    <TableCell className="text-right">{e.rate}%</TableCell>
                    <TableCell className="text-right">{e.fillRate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SectionTitle({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <h2 className="text-lg font-bold pt-2 flex items-center gap-2 border-b border-border pb-2">
      <Icon size={18} className="text-primary" /> {title}
    </h2>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon?: any; label: string; value: number | string; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        {Icon && <div className={`p-2 rounded-lg ${color ?? "bg-primary/10"}`}><Icon size={20} className={color ? "" : "text-primary"} /></div>}
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function CommitmentBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-semibold">{value} ({pct}%)</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

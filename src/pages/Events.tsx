import { runtimeFormatDate as formatDate } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { Calendar, MapPin, Clock, Search, Lock, Globe } from "lucide-react"
import { Input } from "../components/ui/input"
import { Badge } from "../components/ui/badge"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { getEvents } from "../services/eventService"
import { getCategories } from "../services/categoryService"
import { getVenues } from "../services/venueService"
import type { Event, Category, Venue } from "../types"

const cardColors = [
  { bg: "from-teal-500/25 to-amber-500/20", shadow: "shadow-teal-500/15" },
  { bg: "from-amber-500/25 to-orange-500/20", shadow: "shadow-amber-500/15" },
  { bg: "from-red-500/25 to-amber-500/20", shadow: "shadow-red-500/15" },
  { bg: "from-emerald-500/25 to-teal-500/20", shadow: "shadow-emerald-500/15" },
  { bg: "from-yellow-500/25 to-amber-500/20", shadow: "shadow-yellow-500/15" },
  { bg: "from-teal-500/25 to-rose-500/20", shadow: "shadow-teal-500/15" },
  { bg: "from-lime-500/25 to-emerald-500/20", shadow: "shadow-lime-500/15" },
  { bg: "from-sky-500/25 to-teal-500/20", shadow: "shadow-sky-500/15" },
]

export function Events() {
  const { t, tp } = useLanguage()
  
  const [events, setEvents] = useState<Event[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [dateSort, setDateSort] = useState<"asc" | "desc">("asc")

  useEffect(() => {
    Promise.all([getEvents(), getCategories(), getVenues()]).then(([e, c, v]) => {
      setEvents(e)
      setCategories(c)
      setVenues(v)
      setLoading(false)
    })
  }, [])

  const filtered = events
    .filter((e) => {
      if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !e.description.toLowerCase().includes(search.toLowerCase())) return false
      if (categoryFilter && e.categoryId !== categoryFilter) return false
      return true
    })
    .sort((a, b) => {
      const d = new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      return dateSort === "asc" ? d : -d
    })

  if (loading) return <Loading text={t("Loading events...")} />

  return (
    <div className="relative max-w-7xl mx-auto px-4 py-12">
      <div className="absolute top-10 left-10 w-80 h-80 bg-teal-500/12 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-30 right-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-40 left-1/3 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-1/4 w-56 h-56 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative animate-fade-in-up">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">
            <span className="bg-gradient-to-r from-[hsl(185,85%,38%)] via-[hsl(165,80%,40%)] to-[hsl(35,92%,52%)] bg-clip-text text-transparent">
              {t("Events")}
            </span>
          </h1>
          <Badge variant="secondary" className="text-sm">{tp("{count} event", "{count} events", filtered.length)}</Badge>
        </div>

        <div className="flex flex-wrap gap-3 mb-8">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t("Search events...")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">{t("All categories")}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={dateSort} onChange={(e) => setDateSort(e.target.value as "asc" | "desc")}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="asc">{t("Upcoming first")}</option>
            <option value="desc">{t("Latest first")}</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title={t("No events found")} description={search || categoryFilter ? t("Try adjusting your search or filters.") : t("No events available yet.")} />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((event, i) => {
  
              const cat = categories.find((c) => c.id === event.categoryId)
              const venue = venues.find((v) => v.id === event.venueId)
              const c = cardColors[i % cardColors.length]
              return (
                <Link key={event.id} to={`/events/${event.id}`} className="group block animate-fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className={`rounded-xl border border-border bg-card overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 ${c.shadow}`}>
                    <div className={`h-48 flex items-center justify-center relative bg-gradient-to-br ${c.bg}`}>
                      <Calendar size={48} className="text-foreground/15" />
                      {cat && (
                        <div className="absolute top-3 left-3">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/70 dark:bg-background/70 backdrop-blur-sm text-xs font-medium border border-border/50">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.colorCode }} />
                            {cat.name}
                          </div>
                        </div>
                      )}
                      <div className="absolute top-3 right-3 flex gap-1.5">
                        <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium backdrop-blur-sm border ${event.visibility === "private" ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20" : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"}`}>
                          {event.visibility === "private" ? <Lock size={10} /> : <Globe size={10} />}
                          {event.visibility === "private" ? t("Private") : "Public"}
                        </span>
                        {event.status === "draft" && (
                          <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-medium backdrop-blur-sm border border-amber-500/20">
                            {t("Draft")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">{event.title}</h3>
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{event.description}</p>
                      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar size={14} />{formatDate(event.startDate)}</span>
                        <span className="flex items-center gap-1"><MapPin size={14} />{venue?.name ?? t("Unknown venue")}</span>
                        <span className="flex items-center gap-1"><Clock size={14} />{event.capacity} {t("spots")}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

import { runtimeFormatDate as formatDate } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { Calendar, ArrowRight, Sparkles, TrendingUp, Ticket, Zap } from "lucide-react"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { getEvents } from "../services/eventService"
import { getCategories } from "../services/categoryService"
import type { Event, Category } from "../types"

const cardColors = [
  { bg: "from-teal-500/20 to-amber-500/20", icon: "from-teal-500 to-amber-500", shadow: "shadow-teal-500/20" },
  { bg: "from-amber-500/20 to-orange-500/20", icon: "from-amber-500 to-orange-500", shadow: "shadow-amber-500/20" },
  { bg: "from-red-500/20 to-amber-500/20", icon: "from-red-500 to-amber-500", shadow: "shadow-red-500/20" },
  { bg: "from-emerald-500/20 to-teal-500/20", icon: "from-emerald-500 to-teal-500", shadow: "shadow-emerald-500/20" },
  { bg: "from-yellow-500/20 to-amber-500/20", icon: "from-yellow-500 to-amber-500", shadow: "shadow-yellow-500/20" },
  { bg: "from-teal-500/20 to-rose-500/20", icon: "from-teal-500 to-rose-500", shadow: "shadow-teal-500/20" },
]

export function Home() {
  const { t } = useLanguage()
  
  const [featured, setFeatured] = useState<Event[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getEvents(), getCategories()]).then(([e, c]) => {
      setFeatured(e.slice(0, 3))
      setCategories(c)
      setLoading(false)
    })
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-4">
      <section className="relative py-20 lg:py-28 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-teal-500/[0.08] via-amber-500/[0.04] to-transparent pointer-events-none" />
        <div className="absolute top-5 left-1/4 w-80 h-80 bg-teal-500/15 rounded-full blur-3xl" />
        <div className="absolute top-10 right-1/4 w-72 h-72 bg-amber-500/12 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-1/3 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/3 w-60 h-60 bg-red-500/10 rounded-full blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-teal-500/20 to-amber-500/20 text-teal-700 dark:text-teal-300 text-sm font-medium mb-6 border border-teal-500/20">
            <Sparkles size={16} /> {t("All-in-one event platform")}
          </div>
          <h1 className="text-5xl lg:text-6xl font-bold mb-4 tracking-tight">
            <span className="bg-gradient-to-r from-[hsl(185,85%,38%)] via-[hsl(165,80%,40%)] to-[hsl(35,92%,52%)] bg-clip-text text-transparent">
              {t("Discover & Manage")}
            </span>
            <br />
            {t("Events")}
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
            {t("The all-in-one platform for creating, managing, and attending events. From conferences to workshops, EventFlow makes it seamless.")}
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/events">
              <Button variant="gradient" size="lg" className="gap-2 shadow-lg shadow-teal-500/25">
                {t("Browse Events")} <ArrowRight size={18} />
              </Button>
            </Link>
            <Link to="/register">
              <Button variant="outline" size="lg">
                {t("Get Started")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="relative py-16 overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500/[0.06] via-amber-500/[0.04] to-emerald-500/[0.04] border border-teal-500/10">
        <div className="absolute top-0 right-0 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="relative px-8">
          <h2 className="text-2xl font-bold text-center mb-12">
            <span className="bg-gradient-to-r from-teal-500 to-amber-500 bg-clip-text text-transparent">
              {t("How It Works")}
            </span>
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: t("Create Events"), desc: "Organizers can create and publish events in minutes with our powerful tools.", icon: Calendar, grad: "from-teal-500 to-amber-500" },
              { title: t("Register Attendees"), desc: "Attendees can browse, register, and receive digital tickets instantly.", icon: Ticket, grad: "from-amber-500 to-orange-500" },
              { title: t("Track Attendance"), desc: "Scan QR codes at the door for seamless check-in and attendance tracking.", icon: TrendingUp, grad: "from-red-500 to-amber-500" },
            ].map((item) => (
              <div key={item.title} className="relative group">
                <div className={`absolute -inset-0.5 bg-gradient-to-r ${item.grad} rounded-xl blur-sm opacity-0 group-hover:opacity-30 transition-opacity`} />
                <div className="relative p-6 rounded-xl border border-border bg-white/60 dark:bg-card/60 backdrop-blur-sm">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.grad} flex items-center justify-center mb-4 shadow-lg`}>
                    <item.icon className="text-white" size={22} />
                  </div>
                  <h3 className="font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {!loading && featured.length > 0 && (
        <section className="py-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">{t("Featured Events")}</h2>
            <Link to="/events" className="text-sm text-primary hover:underline">{t("&rarr; View all")}</Link>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {featured.map((event, idx) => {
              const c = cardColors[idx % cardColors.length]
              return (
                <Link key={event.id} to={`/events/${event.id}`} className="group block animate-fade-in-up" style={{ animationDelay: `${idx * 100}ms` }}>
                  <div className={`rounded-xl border border-border bg-card overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 ${c.shadow}`}>
                    <div className={`h-44 flex items-center justify-center bg-gradient-to-br ${c.bg}`}>
                      <Calendar size={40} className="text-foreground/20" />
                    </div>
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        {categories.find((cat) => cat.id === event.categoryId) && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: categories.find((cat) => cat.id === event.categoryId)?.colorCode }} />
                            {categories.find((cat) => cat.id === event.categoryId)?.name}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold group-hover:text-primary transition-colors">{event.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(event.startDate)}</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <section className="relative py-16 text-center overflow-hidden rounded-2xl mb-16">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/[0.08] via-amber-500/[0.06] to-yellow-500/[0.05] rounded-2xl border border-teal-500/10" />
        <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-teal-500/15 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-amber-500/12 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-56 h-56 bg-yellow-500/10 rounded-full blur-3xl" />
        <div className="relative px-8 py-12">
          <div className="max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 via-amber-500 to-yellow-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-teal-500/25">
              <Zap size={28} className="text-white" />
            </div>
            <h2 className="text-3xl font-bold mb-4">
              <span className="bg-gradient-to-r from-teal-500 via-amber-500 to-yellow-500 bg-clip-text text-transparent">
                {t("Ready to get started?")}
              </span>
            </h2>
            <p className="text-muted-foreground mb-6">{t("Create an account and start managing your events today.")}</p>
            <Link to="/register">
              <Button variant="gradient" size="lg" className="gap-2 shadow-lg shadow-teal-500/25">
                {t("Create Free Account")} <ArrowRight size={18} />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

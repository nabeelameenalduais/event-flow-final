import { useState, useEffect } from "react"
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom"
import {
  LayoutDashboard, Calendar, User, Moon, Sun, Menu, X, Globe,
  LogOut, ChevronDown, UserCog, Layers, Building2, ListTodo,
  Bell, FileUp, BarChart3, Settings, Shield, PlusCircle, Ban,
  Wallet, Users, Mail, Megaphone, KeyRound,
} from "lucide-react"
import { Toaster } from "../ui/toaster"
import { Avatar, AvatarFallback } from "../ui/avatar"
import { Button } from "../ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import { useSettings } from "../../contexts/SettingsContext"
import { useTheme } from "../../contexts/ThemeContext"
import { usePageTitle } from "../../lib/usePageTitle"
import { getUnreadCount, getNotifications, markAllAsRead } from "../../services/notificationService"
import ChatWidget from "../chat/ChatWidget"

export function AppLayout() {
  const { user, profile, role, logout } = useAuth()
  const { appName, logoUrl } = useSettings()
  const { theme, toggleTheme } = useTheme()
  const { t, isRtl, language, setLanguage, formatDate, localizeError } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  usePageTitle(location.pathname)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [recentNotifs, setRecentNotifs] = useState<any[]>([])
  const [notifOpen, setNotifOpen] = useState(false)

  useEffect(() => {
    if (!profile) return
    getUnreadCount(profile.userId).then(setUnread)
    getNotifications(profile.userId).then((n) => setRecentNotifs(n.slice(0, 5)))
  }, [profile])

  // A temporary password issued by an administrator must be replaced before
  // the user can reach any other dashboard page.
  useEffect(() => {
    if (!user?.mustChangePassword) return
    if (location.pathname === "/dashboard/change-password") return
    navigate("/dashboard/change-password", { replace: true })
  }, [user?.mustChangePassword, location.pathname, navigate])

  const handleMarkAllRead = async () => {
    if (!profile) return
    await markAllAsRead(profile.userId)
    setUnread(0)
    setRecentNotifs((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })))
  }

  const initials = `${profile?.firstName?.[0] ?? ""}${profile?.lastName?.[0] ?? ""}`

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const sidebarLinks = [
    { to: "/dashboard", label: t("Dashboard"), icon: LayoutDashboard },
    { to: "/events", label: t("Browse Events"), icon: Calendar },
    { to: "/dashboard/event-requests", label: t("Event Requests"), icon: PlusCircle },
  ]

  if (role === "organizer" || role === "admin") {
    sidebarLinks.push({ to: "/dashboard/events", label: t("My Events"), icon: ListTodo })
    sidebarLinks.push({ to: "/dashboard/bans", label: t("Bans"), icon: Ban })
    sidebarLinks.push({ to: "/dashboard/finance", label: t("Finance"), icon: Wallet })
    sidebarLinks.push({ to: "/dashboard/audience", label: t("Audience"), icon: Users })
    sidebarLinks.push({ to: "/dashboard/campaigns", label: t("Campaigns"), icon: Mail })
  }

  if (role === "admin") {
    sidebarLinks.push({ to: "/dashboard/admin/users", label: t("Users"), icon: UserCog })
    sidebarLinks.push({ to: "/dashboard/admin/categories", label: t("Categories"), icon: Layers })
    sidebarLinks.push({ to: "/dashboard/admin/venues", label: t("Venues"), icon: Building2 })
    sidebarLinks.push({ to: "/dashboard/admin/files", label: t("Files"), icon: FileUp })
    sidebarLinks.push({ to: "/dashboard/admin/reports", label: t("Reports"), icon: BarChart3 })
    sidebarLinks.push({ to: "/dashboard/admin/broadcast", label: t("Broadcast"), icon: Megaphone })
    sidebarLinks.push({ to: "/dashboard/admin/password-resets", label: t("Password Resets"), icon: KeyRound })
    sidebarLinks.push({ to: "/dashboard/admin/settings", label: t("Settings"), icon: Settings })
    sidebarLinks.push({ to: "/dashboard/admin/security", label: t("Security"), icon: Shield })
  }

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/")

  return (
    <div className="flex h-screen bg-background">
      <aside className={`fixed inset-y-0 start-0 z-50 flex h-screen w-64 flex-col border-e border-border transform transition-transform lg:relative lg:h-full lg:translate-x-0 bg-white/90 dark:bg-card/90 backdrop-blur-xl ${sidebarOpen ? "translate-x-0" : isRtl ? "translate-x-full" : "-translate-x-full"} lg:translate-x-0`}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
          <Link to="/dashboard" className="flex items-center gap-2 text-xl font-bold">
            {logoUrl && <img src={logoUrl} alt="" className="h-7 w-auto" />}
            <span className="bg-gradient-to-r from-[hsl(185,85%,38%)] via-[hsl(165,80%,40%)] to-[hsl(35,92%,52%)] bg-clip-text text-transparent">
              {appName}
            </span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-4">
          {sidebarLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors relative ${
                isActive(link.to)
                  ? "text-primary bg-gradient-to-r from-teal-500/10 to-amber-500/10 font-medium before:absolute before:start-0 before:top-1/4 before:h-1/2 before:w-0.5 before:rounded-full before:bg-gradient-to-b before:from-teal-500 before:to-amber-500"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <link.icon size={20} /> {t(link.label)}
            </Link>
          ))}
        </nav>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-white/80 dark:bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6 relative">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 via-amber-500/30 to-transparent" />
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-1.5 ms-auto sm:gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={t("Language")}
                className="flex items-center gap-1.5 p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent/50 outline-none"
              >
                <Globe size={18} />
                <span className="hidden text-xs font-medium sm:inline">{language === "ar" ? "العربية" : "English"}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setLanguage("ar")}>العربية</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setLanguage("en")}>English</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button onClick={toggleTheme} aria-label={t("Toggle theme")} className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent/50">
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
              <DropdownMenuTrigger aria-label={t("Notifications")} className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent/50 outline-none">
                <Bell size={18} />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground px-1">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <span className="text-sm font-medium">{t("Notifications")}</span>
                  {unread > 0 && (
                    <Button size="sm" variant="ghost" className="h-auto py-0.5 text-xs" onClick={handleMarkAllRead}>
                      {t("Mark all read")}
                    </Button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {recentNotifs.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">{t("No notifications")}</p>
                  ) : (
                    recentNotifs.map((n) => (
                      <div key={n.id} className={`border-b border-border px-3 py-2.5 last:border-0 ${!n.readAt ? "bg-primary/5" : ""}`}>
                        <p className="text-sm">{localizeError(n.message)}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDate(n.createdAt)}</p>
                      </div>
                    ))
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => { navigate("/dashboard/notifications"); setNotifOpen(false) }}>
                  <Bell size={16} /> {t("View all notifications")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-accent/50 outline-none">
                <Avatar className="h-7 w-7 ring-2 ring-teal-500/30">
                  <AvatarFallback className="bg-gradient-to-br from-teal-500/20 to-amber-500/20 text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="hidden text-start sm:block">
                  <p className="text-sm font-medium leading-tight">{profile?.firstName} {profile?.lastName}</p>
                  <p className="text-xs leading-tight text-muted-foreground capitalize">{localizeError(role)}</p>
                </div>
                <ChevronDown size={14} className="hidden text-muted-foreground sm:block" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate("/dashboard/profile")}>
                  <User size={16} /> {t("Profile")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggleTheme}>
                  {theme === "light" ? <Moon size={16} /> : <Sun size={16} />} {t("Toggle theme")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut size={16} /> {t("Logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
      <Toaster />
      <ChatWidget />
    </div>
  )
}

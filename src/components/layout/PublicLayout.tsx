import { Outlet, Link, useLocation } from "react-router-dom"
import { Toaster } from "../ui/toaster"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import { useSettings } from "../../contexts/SettingsContext"
import { useTheme } from "../../contexts/ThemeContext"
import { usePageTitle } from "../../lib/usePageTitle"
import { Globe, Moon, Sun } from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import ChatWidget from "../chat/ChatWidget"

export function PublicLayout() {
  const { isAuthenticated, profile, role } = useAuth()
  const { appName, logoUrl } = useSettings()
  const { theme, toggleTheme } = useTheme()
  const { t, language, setLanguage } = useLanguage()
  const location = useLocation()
  usePageTitle(location.pathname)

  const isOrganizerOrAdmin = role === "organizer" || role === "admin"

  const navLinks = [
    ...(!isOrganizerOrAdmin ? [{ to: "/", label: t("Home") }] : []),
    { to: "/events", label: t("Events") },
    ...(!isOrganizerOrAdmin ? [{ to: "/about", label: t("About") }, { to: "/contact", label: t("Contact") }] : []),
    ...(isOrganizerOrAdmin ? [{ to: "/dashboard", label: t("Dashboard") }] : []),
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-white/80 dark:bg-card/80 backdrop-blur-sm">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 via-amber-500/30 via-emerald-500/30 to-transparent" />
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold">
            {logoUrl && <img src={logoUrl} alt="" className="h-7 w-auto" />}
            <span className="bg-gradient-to-r from-[hsl(185,85%,38%)] via-[hsl(165,80%,40%)] to-[hsl(35,92%,52%)] bg-clip-text text-transparent">
              {appName}
            </span>
          </Link>
          <nav className="hidden items-center gap-6 sm:flex">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`relative text-sm transition-colors ${
                  location.pathname === link.to
                    ? "font-medium text-foreground after:absolute after:-bottom-1 after:inset-x-0 after:h-0.5 after:rounded-full after:bg-gradient-to-r after:from-teal-500 after:via-amber-500 after:to-emerald-500"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(link.label)}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={t("Language")}
                className="flex items-center gap-1.5 rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground outline-none"
              >
                <Globe size={18} />
                <span className="hidden text-xs font-medium sm:inline">{language === "ar" ? "العربية" : "English"}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setLanguage("ar")}>العربية</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setLanguage("en")}>English</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button onClick={toggleTheme} aria-label={t("Toggle theme")} className="text-muted-foreground transition-colors hover:text-foreground">
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            {isAuthenticated ? (
              <Link to="/dashboard" className="rounded-lg bg-gradient-to-r from-teal-500 via-amber-500 to-emerald-500 px-4 py-2 text-sm text-white shadow-lg shadow-teal-500/25 transition-opacity hover:opacity-90">
                {t("Dashboard ({name})", { name: profile?.firstName ?? "" })}
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">{t("Login")}</Link>
                <Link to="/register" className="rounded-lg bg-gradient-to-r from-teal-500 via-amber-500 to-emerald-500 px-4 py-2 text-sm text-white shadow-lg shadow-teal-500/25 transition-opacity hover:opacity-90">{t("Register")}</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="relative mt-16 border-t border-border bg-gradient-to-r from-teal-500/[0.03] via-amber-500/[0.03] to-emerald-500/[0.03] py-8">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 via-amber-500/30 via-emerald-500/30 to-transparent" />
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {appName}. {t("All rights reserved.")}
        </div>
      </footer>
      <Toaster />
      <ChatWidget />
    </div>
  )
}

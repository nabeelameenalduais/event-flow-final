import { StrictMode, Suspense } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router-dom"
import { AuthProvider } from "./contexts/AuthContext"
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext"
import { SettingsProvider } from "./contexts/SettingsContext"
import { ThemeProvider } from "./contexts/ThemeContext"
import { router } from "./routes"
import "@fontsource/tajawal/arabic-400.css"
import "@fontsource/tajawal/arabic-500.css"
import "@fontsource/tajawal/arabic-700.css"
import "./index.css"

function AppFallback() {
  const { t } = useLanguage()
  return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">{t("Loading…")}</div>
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <SettingsProvider>
          <AuthProvider>
            <Suspense fallback={<AppFallback />}>
              <RouterProvider router={router} />
            </Suspense>
          </AuthProvider>
        </SettingsProvider>
      </LanguageProvider>
    </ThemeProvider>
  </StrictMode>,
)

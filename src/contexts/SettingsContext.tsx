import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { getSettings } from "../services/settingsService"
import type { AppSettings } from "../types"

const DEFAULT_APP_NAME = "EventFlow"

interface SettingsContextType {
  settings: AppSettings | null
  appName: string
  logoUrl: string
  refreshSettings: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextType | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  const refreshSettings = useCallback(async () => {
    try {
      const loaded = await getSettings()
      setSettings(loaded)
    } catch {
      // Keep defaults when the settings row cannot be loaded.
    }
  }, [])

  useEffect(() => {
    refreshSettings()
  }, [refreshSettings])

  const appName = settings?.appName?.trim() || DEFAULT_APP_NAME
  const logoUrl = settings?.logoUrl?.trim() || ""
  const faviconUrl = settings?.faviconUrl?.trim() || ""

  useEffect(() => {
    if (!faviconUrl) return
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
    if (!link) {
      link = document.createElement("link")
      link.rel = "icon"
      document.head.appendChild(link)
    }
    link.href = faviconUrl
  }, [faviconUrl])

  return (
    <SettingsContext.Provider value={{ settings, appName, logoUrl, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider")
  return ctx
}

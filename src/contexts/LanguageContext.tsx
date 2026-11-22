import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  DEFAULT_LANGUAGE,
  isLanguage,
  isRtl,
  LANGUAGE_STORAGE_KEY,
  plural,
  translate,
  type Language,
  type TranslationVars,
} from "../i18n"
import {
  formatCurrency as formatCurrencyValue,
  formatDate as formatDateValue,
  formatDateTime as formatDateTimeValue,
  formatNumber as formatNumberValue,
  formatTime as formatTimeValue,
  formatPercent as formatPercentValue,
} from "../i18n/formatters"
import { localizeMessage } from "../i18n/messageLocalizer"
import { setRuntimeLanguage } from "../i18n/runtimeLocale"

export type { Language }

interface LanguageContextType {
  language: Language
  setLanguage: (language: Language) => void
  toggleLanguage: () => void
  isRtl: boolean
  t: (key: string, vars?: TranslationVars) => string
  tp: (singularKey: string, pluralKey: string, count: number, vars?: TranslationVars) => string
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
  formatDate: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string
  formatDateTime: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string
  formatTime: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string
  formatCurrency: (amount: number, currencyCode: string) => string
  formatPercent: (value: number, digits?: number) => string
  localizeError: (message: unknown) => string
}

const LanguageContext = createContext<LanguageContextType | null>(null)

function readStoredLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (isLanguage(stored)) return stored
  } catch {
    // Storage may be unavailable; fall back to Arabic.
  }
  return DEFAULT_LANGUAGE
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage)

  // Keep non-React helpers in sync before children render so dates, times and
  // numbers use the new locale on the very first render after a switch.
  setRuntimeLanguage(language)

  const setLanguage = useCallback((next: Language) => setLanguageState(next), [])
  const toggleLanguage = useCallback(() => {
    setLanguageState((current) => (current === "ar" ? "en" : "ar"))
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.lang = language
    root.dir = isRtl(language) ? "rtl" : "ltr"
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    } catch {
      // Ignore storage failures; switching still works for this session.
    }
    setRuntimeLanguage(language)
  }, [language])

  const value = useMemo<LanguageContextType>(() => {
    const t = (key: string, vars?: TranslationVars) => translate(language, key, vars)
    return {
      language,
      setLanguage,
      toggleLanguage,
      isRtl: isRtl(language),
      t,
      tp: (singularKey, pluralKey, count, vars) => plural(language, singularKey, pluralKey, count, vars),
      formatNumber: (number, options) => formatNumberValue(language, number, options),
      formatDate: (date, options) => formatDateValue(language, date, options),
      formatDateTime: (date, options) => formatDateTimeValue(language, date, options),
      formatTime: (date, options) => formatTimeValue(language, date, options),
      formatCurrency: (amount, currencyCode) => formatCurrencyValue(language, amount, currencyCode),
      formatPercent: (number, digits) => formatPercentValue(language, number, digits),
      localizeError: (message) => localizeMessage(language, message),
    }
  }, [language, setLanguage, toggleLanguage])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider")
  return ctx
}

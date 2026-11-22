import { DEFAULT_LANGUAGE, translate, type Language, type TranslationVars } from "./index"
import { formatDate, formatDateTime, formatNumber, formatTime } from "./formatters"
import { localizeMessage } from "./messageLocalizer"

function initialLanguage(): Language {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("eventflow.language")
      if (stored === "ar" || stored === "en") return stored
    } catch {
      // Storage may be unavailable; fall back to Arabic.
    }
  }
  return DEFAULT_LANGUAGE
}

let currentLanguage: Language = initialLanguage()

/** Called by LanguageProvider so non-React modules can produce localized text. */
export function setRuntimeLanguage(language: Language): void {
  currentLanguage = language
}

export function getRuntimeLanguage(): Language {
  return currentLanguage
}

export function runtimeT(key: string, vars?: TranslationVars): string {
  return translate(currentLanguage, key, vars)
}

export function runtimeFormatDate(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  return formatDate(currentLanguage, value, options)
}

export function runtimeFormatDateTime(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  return formatDateTime(currentLanguage, value, options)
}

export function runtimeFormatTime(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  return formatTime(currentLanguage, value, options)
}

export function runtimeFormatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return formatNumber(currentLanguage, value, options)
}

/** Localize service/error/notification messages outside React components. */
export function runtimeLocalizeMessage(message: unknown): string {
  return localizeMessage(currentLanguage, message)
}

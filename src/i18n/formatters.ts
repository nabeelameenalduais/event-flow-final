import { getLocale, type Language } from "./index"

type DateInput = string | number | Date

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value)
}

/**
 * Numbers are localized only in Arabic. English keeps the original
 * `toLocaleString()` rendering so its appearance is unchanged.
 */
export function formatNumber(language: Language, value: number, options?: Intl.NumberFormatOptions): string {
  if (language === "en") return options ? value.toLocaleString(undefined, options) : value.toLocaleString()
  return new Intl.NumberFormat(getLocale(language), options).format(value)
}

/**
 * Dates use Arabic-Egypt formatting in Arabic and the original default
 * `toLocaleDateString()` rendering in English.
 */
export function formatDate(language: Language, value: DateInput, options?: Intl.DateTimeFormatOptions): string {
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return ""
  if (language === "en") return options ? date.toLocaleDateString(undefined, options) : date.toLocaleDateString()
  return new Intl.DateTimeFormat(getLocale(language), options ?? { day: "numeric", month: "short", year: "numeric" }).format(date)
}

/** Date + time: Arabic is localized; English keeps the original `toLocaleString()`. */
export function formatDateTime(language: Language, value: DateInput, options?: Intl.DateTimeFormatOptions): string {
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return ""
  if (language === "en") return options ? date.toLocaleString(undefined, options) : date.toLocaleString()
  return new Intl.DateTimeFormat(getLocale(language), options ?? { dateStyle: "medium", timeStyle: "short" }).format(date)
}

/** Time only: Arabic is localized; English keeps the original `toLocaleTimeString()`. */
export function formatTime(
  language: Language,
  value: DateInput,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return ""
  if (language === "en") return options ? date.toLocaleTimeString([], options) : date.toLocaleTimeString()
  return new Intl.DateTimeFormat(getLocale(language), options ?? { hour: "2-digit", minute: "2-digit" }).format(date)
}

/** Keep the currency code in Latin characters; localize only the amount. */
export function formatCurrency(language: Language, amount: number, currencyCode: string): string {
  return `${formatNumber(language, amount)} ${currencyCode}`
}

export function formatPercent(language: Language, value: number, digits = 0): string {
  return formatNumber(language, value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }) + "%"
}

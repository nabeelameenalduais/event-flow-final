import { ar } from "./ar"
import { en } from "./en"

export type Language = "ar" | "en"
export type TranslationVars = Record<string, string | number>

const dictionaries: Record<Language, Record<string, string>> = { ar, en }

export const DEFAULT_LANGUAGE: Language = "ar"
export const LANGUAGE_STORAGE_KEY = "eventflow.language"

export function isLanguage(value: unknown): value is Language {
  return value === "ar" || value === "en"
}

export function getLocale(language: Language): string {
  return language === "ar" ? "ar-EG" : "en-US"
}

export function isRtl(language: Language): boolean {
  return language === "ar"
}

function interpolate(message: string, vars?: TranslationVars): string {
  if (!vars) return message
  return message.replace(/\{\{?\s*([\w.-]+)\s*\}\}?/g, (token, name: string) => {
    const value = vars[name]
    return value === undefined ? token : String(value)
  })
}

/** Look up a source string in the active dictionary and interpolate variables. */
export function translate(language: Language, key: string, vars?: TranslationVars): string {
  const dictionary = dictionaries[language]
  return interpolate(dictionary[key] ?? en[key] ?? key, vars)
}

/** Pick the singular or plural form using the active language's plural rules. */
export function plural(
  language: Language,
  singularKey: string,
  pluralKey: string,
  count: number,
  vars?: TranslationVars,
): string {
  const form = new Intl.PluralRules(getLocale(language)).select(count)
  const key = form === "one" ? singularKey : pluralKey
  return translate(language, key, { ...vars, count })
}

export function translator(language: Language): (key: string, vars?: TranslationVars) => string {
  return (key, vars) => translate(language, key, vars)
}

export function hasTranslation(language: Language, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(dictionaries[language], key)
}

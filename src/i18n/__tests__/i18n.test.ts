import { describe, it, expect } from "vitest"
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  getLocale,
  hasTranslation,
  isLanguage,
  isRtl,
  plural,
  translate,
  translator,
} from "../index"

describe("i18n core", () => {
  describe("language helpers", () => {
    it("defaults to Arabic", () => {
      expect(DEFAULT_LANGUAGE).toBe("ar")
    })

    it("uses the expected storage key", () => {
      expect(LANGUAGE_STORAGE_KEY).toBe("eventflow.language")
    })

    it("accepts only ar and en", () => {
      expect(isLanguage("ar")).toBe(true)
      expect(isLanguage("en")).toBe(true)
      expect(isLanguage("fr")).toBe(false)
      expect(isLanguage(undefined)).toBe(false)
      expect(isLanguage(null)).toBe(false)
    })

    it("maps languages to locales", () => {
      expect(getLocale("ar")).toBe("ar-EG")
      expect(getLocale("en")).toBe("en-US")
    })

    it("identifies RTL correctly", () => {
      expect(isRtl("ar")).toBe(true)
      expect(isRtl("en")).toBe(false)
    })
  })

  describe("translate", () => {
    it("returns Arabic translations", () => {
      expect(translate("ar", "Events")).toBe("الفعاليات")
      expect(translate("ar", "Dashboard")).toBe("لوحة التحكم")
      expect(translate("ar", "Login")).toBe("تسجيل الدخول")
    })

    it("returns English text verbatim", () => {
      expect(translate("en", "Events")).toBe("Events")
      expect(translate("en", "Dashboard")).toBe("Dashboard")
      expect(translate("en", "Login")).toBe("Login")
    })

    it("interpolates {var} placeholders", () => {
      expect(translate("ar", "Signed in with {email}", { email: "user@example.com" }))
        .toBe("تم تسجيل الدخول باستخدام user@example.com")
      expect(translate("en", "Signed in with {email}", { email: "user@example.com" }))
        .toBe("Signed in with user@example.com")
    })

    it("interpolates {{var}} placeholders", () => {
      expect(translate("en", "Hello {{name}}", { name: "World" })).toBe("Hello World")
    })

    it("leaves unknown placeholders untouched", () => {
      expect(translate("ar", "Hello {{name}}", { other: "x" })).toBe("Hello {{name}}")
    })

    it("returns the key when no translation exists", () => {
      expect(translate("ar", "Completely unknown key XYZ")).toBe("Completely unknown key XYZ")
    })

    it("creates a bound translator", () => {
      const t = translator("ar")
      expect(t("Events")).toBe("الفعاليات")
      expect(t("Events")).toBe(translate("ar", "Events"))
    })

    it("reports translation presence", () => {
      expect(hasTranslation("ar", "Events")).toBe(true)
      expect(hasTranslation("ar", "Completely unknown key XYZ")).toBe(false)
    })
  })

  describe("plural", () => {
    it("uses Arabic plural rules", () => {
      // Arabic has zero, one, two, few, many, other; locale ar-EG selects "one" for 1.
      expect(plural("ar", "Signed out {count} other session", "Signed out {count} other sessions", 1))
        .toBe("تم تسجيل خروج 1 جلسة أخرى")
    })

    it("uses English plural rules", () => {
      expect(plural("en", "Reminder sent to {count} attendee", "Reminder sent to {count} attendees", 1))
        .toBe("Reminder sent to 1 attendee")
      expect(plural("en", "Reminder sent to {count} attendee", "Reminder sent to {count} attendees", 3))
        .toBe("Reminder sent to 3 attendees")
    })

    it("passes custom variables through", () => {
      expect(plural("en", "{name} has {count} ticket", "{name} has {count} tickets", 2, { name: "Ali" }))
        .toBe("Ali has 2 tickets")
      expect(plural("ar", "Signed out {count} other session", "Signed out {count} other sessions", 0))
        .toBe("تم تسجيل خروج 0 جلسات أخرى")
    })
  })
})

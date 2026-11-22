import { describe, it, expect } from "vitest"
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatTime,
} from "../formatters"

const testDate = new Date(2024, 0, 15, 14, 30, 0)

describe("formatters", () => {
  describe("formatNumber", () => {
    it("uses Arabic numerals in Arabic", () => {
      const result = formatNumber("ar", 1234)
      expect(result).not.toBe("1234")
      expect(result).not.toMatch(/^[0-9,]+$/)
      expect(result.length).toBeGreaterThan(0)
    })

    it("keeps English formatting unchanged", () => {
      expect(formatNumber("en", 1234)).toBe((1234).toLocaleString())
    })

    it("respects options in both languages", () => {
      expect(formatNumber("en", 1234.5, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
        .toBe((1234.5).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
      expect(formatNumber("ar", 1234.5, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
        .not.toMatch(/^[0-9,.]+$/)
    })
  })

  describe("formatDate", () => {
    it("formats dates in Arabic", () => {
      const result = formatDate("ar", testDate)
      expect(result).toBeTruthy()
      expect(result).not.toBe(testDate.toLocaleDateString())
    })

    it("preserves English date formatting", () => {
      expect(formatDate("en", testDate)).toBe(testDate.toLocaleDateString())
    })

    it("returns empty string for invalid dates", () => {
      expect(formatDate("ar", "not-a-date")).toBe("")
      expect(formatDate("en", "not-a-date")).toBe("")
    })
  })

  describe("formatDateTime", () => {
    it("formats date and time in Arabic", () => {
      const result = formatDateTime("ar", testDate)
      expect(result).toBeTruthy()
      expect(result).not.toBe(testDate.toLocaleString())
    })

    it("preserves English date-time formatting", () => {
      expect(formatDateTime("en", testDate)).toBe(testDate.toLocaleString())
    })

    it("returns empty string for invalid dates", () => {
      expect(formatDateTime("ar", "not-a-date")).toBe("")
    })
  })

  describe("formatTime", () => {
    it("formats time in Arabic", () => {
      const result = formatTime("ar", testDate)
      expect(result).toBeTruthy()
    })

    it("preserves English time formatting", () => {
      expect(formatTime("en", testDate)).toBe(testDate.toLocaleTimeString())
    })

    it("returns empty string for invalid dates", () => {
      expect(formatTime("ar", "not-a-date")).toBe("")
    })
  })

  describe("formatCurrency", () => {
    it("keeps currency code in Latin characters", () => {
      const ar = formatCurrency("ar", 1500, "EGP")
      const en = formatCurrency("en", 1500, "EGP")
      expect(ar).toContain("EGP")
      expect(en).toContain("EGP")
      expect(en).toBe(`${(1500).toLocaleString()} EGP`)
    })
  })

  describe("formatPercent", () => {
    it("formats percentages", () => {
      expect(formatPercent("en", 25)).toBe("25%")
      expect(formatPercent("en", 25.5, 1)).toBe("25.5%")
      expect(formatPercent("ar", 25)).not.toBe("25%")
    })
  })
})

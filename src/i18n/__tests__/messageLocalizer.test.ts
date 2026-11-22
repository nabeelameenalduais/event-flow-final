import { describe, it, expect } from "vitest"
import { localizeMessage } from "../messageLocalizer"

describe("localizeMessage", () => {
  it("returns empty string for null/undefined", () => {
    expect(localizeMessage("ar", null)).toBe("")
    expect(localizeMessage("ar", undefined)).toBe("")
    expect(localizeMessage("ar", "")).toBe("")
  })

  it("localizes exact dictionary keys in Arabic", () => {
    expect(localizeMessage("ar", "Events")).toBe("الفعاليات")
    expect(localizeMessage("ar", "Failed to load")).toBe("تعذّر التحميل")
  })

  it("keeps English messages verbatim", () => {
    expect(localizeMessage("en", "Events")).toBe("Events")
    expect(localizeMessage("en", "Some random service error")).toBe("Some random service error")
  })

  it("localizes rate limit messages with dynamic values", () => {
    const result = localizeMessage("ar", "Rate limit exceeded. Try again in 30 seconds.")
    expect(result).toContain("30")
    expect(result).not.toBe("Rate limit exceeded. Try again in 30 seconds.")
  })

  it("localizes checked-in messages with dynamic names", () => {
    const result = localizeMessage("ar", "Ahmed checked in")
    expect(result).toContain("Ahmed")
    expect(result).not.toBe("Ahmed checked in")
  })

  it("localizes waiting-list messages with dynamic positions", () => {
    const result = localizeMessage("ar", "Event is full — you are number 5 on the waiting list.")
    expect(result).toContain("5")
    expect(result).not.toBe("Event is full — you are number 5 on the waiting list.")
  })

  it("localizes relative time messages", () => {
    const result = localizeMessage("ar", "3 days ago")
    expect(result).toContain("منذ")
  })

  it("leaves unmatched messages unchanged", () => {
    const unknown = "Completely arbitrary unmatched message 12345"
    expect(localizeMessage("ar", unknown)).toBe(unknown)
  })

  it("handles non-string values", () => {
    expect(localizeMessage("ar", 42)).toBe("42")
  })

  it("localizes ban notices with dynamic reason and expiry", () => {
    const source = "You have been restricted by a global ban. Reason: QA-BANS. It ends on 22/11/2026, 5:00 PM. You can still use your account but cannot register for new events covered by this ban."
    const result = localizeMessage("ar", source)
    expect(result).toContain("حظر عام")
    expect(result).toContain("QA-BANS")
    expect(result).toContain("22/11/2026")
    expect(result).not.toContain("You have been restricted")
    expect(localizeMessage("en", source)).toBe(source)
  })

  it("localizes lifted-ban and admin lift-request notices", () => {
    expect(localizeMessage("ar", "The restriction on your account has been lifted. Note: appeal approved"))
      .toContain("تم رفع القيود")
    expect(localizeMessage("ar", "An organizer requested to lift a user ban. Review it on the Bans page."))
      .toContain("صفحة الحظر")
  })

  it("localizes organizer ban-request notifications with registration counts", () => {
    const source = "An organizer requested a ban for this event for a user. Approval is required before it takes effect. The user currently has 2 existing registrations that will not be cancelled."
    const result = localizeMessage("ar", source)
    expect(result).toContain("طلب أحد المنظّمين")
    expect(result).toContain("2")
    expect(result).not.toContain("An organizer requested")
  })

  it("localizes the registration guard message", () => {
    const result = localizeMessage("ar", "You cannot register for this event because of a global ban. Reason: QA-BANS.")
    expect(result).toContain("لا يمكنك التسجيل")
    expect(result).toContain("عام")
    expect(result).toContain("QA-BANS")
  })

  it("localizes ban notification type badges", () => {
    expect(localizeMessage("ar", "ban notice")).toBe("إشعار حظر")
    expect(localizeMessage("ar", "ban request")).toBe("طلب حظر")
    expect(localizeMessage("ar", "ban approved")).toBe("تمت الموافقة على الحظر")
  })

  it("localizes expense approval notices with dynamic purpose and reason", () => {
    const approved = 'Your expense "QA-FIN" was approved.'
    const rejected = 'Your expense "QA-FIN" was rejected.'
    const rejectedWithReason = 'Your expense "QA-FIN" was rejected: budget'

    expect(localizeMessage("ar", approved)).toContain("QA-FIN")
    expect(localizeMessage("ar", approved)).not.toContain("Your expense")
    expect(localizeMessage("ar", rejected)).toContain("QA-FIN")
    expect(localizeMessage("ar", rejected)).toContain("تم رفض")
    expect(localizeMessage("ar", rejectedWithReason)).toContain("budget")
    expect(localizeMessage("ar", rejectedWithReason)).not.toContain("Your expense")

    expect(localizeMessage("en", approved)).toBe(approved)
    expect(localizeMessage("en", rejectedWithReason)).toBe(rejectedWithReason)
  })
})
